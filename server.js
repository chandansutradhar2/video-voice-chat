'use strict';

// for our server we use both express and socket.io
// express is used for serving our static content
// socket.io is used for all messages, in and out

const
	express = require('express'),
	app = express(),
	http = require('http').Server(app),
	io = require('socket.io')(http),
	mongo = require('mongodb').MongoClient,
	bcrypt = require('bcrypt'),
	jwt = require('jwt-simple'),
	helmet = require('helmet'),
	ObjectId = require('mongodb').ObjectId;

// set this here or as an environment variable
var JWT_SECRET = process.env.JWT_SECRET || 'change-me-please!';

var users = [];
var db = null;

// connect to the database
mongo.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ionic-video-chat', (err, d) => {
	if (err) {
		return console.log(err);
	}
	console.log('Connected to mongo');
	db = d;
});

// basic setup
app.use(helmet());
app.use(express.static('www'));

// home
app.get('/', function(req, res) {
	res.sendfile('index.html');
});


// generate random names. borrowed from Project Karma at http://karma.vg
var names = {
	first: ['chocolate','red','blue','pink','grey','purple','black','white','green','fast','slow','sleepy','naked','cooked','silly','yummy','running','flying','sitting',],
	last: ['bunny','penguin','otter','wombat','sloth','koala','panther','shrimp','crab','tuna','salmon','cod','python','flamingo','moose','hawk','eagle','racoon','star','robin','lobster', 'monkey', 'octopus', 'owl', 'panda', 'pig', 'puppy', 'rabbit']
};

var Name = {
	random: () => {
		var first = names.first[Math.floor(Math.random() * names.first.length)];
		var last = names.last[Math.floor(Math.random() * names.last.length)];

		return first.charAt(0).toUpperCase() + first.slice(1) + ' ' + last.charAt(0).toUpperCase() + last.slice(1);
	}
}



// setup socket.io
io.on('connection', function(socket) {

	// pluck the current logged in user from the users array
	let checkUser = () => {
		for (let i in users) {
			if (socket.id == users[i].socket) {
				return users[i];
			}
		}
		return false;
	}

	// pluck the users connection by id
	let getSocket = user => {
		for (let i in users) {
			if ((user.id || user._id) == users[i].id) {
				return users[i];
			}
		}
		return false;
	}
/*
	let exportUser = user => {
		let usr = {
			name: user.name,
			username: user.username,
			image: user.image,
			id: user.id || (user._id + '')
		};
	};
*/
	// log a user in
	let logUserIn = user => {
		let usr = {
			name: user.name,
			username: user.username,
			image: user.image,
			id: user._id + '',
			online: true
		};
		users.push({
			id: usr.id,
			user: usr,
			socket: socket.id
		});

		// @todo: needs to work
		let us = users.map(u => {
			if (u.id != user.id) {
				return u.user;
			} else {
				return null;
			}
		});
		console.log(us);

		// create the jwt
		var token = jwt.encode(usr, JWT_SECRET, 'HS512');

		getContacts(user).then(contacts => {
			console.log('contacts >', contacts)
			socket.emit('login_successful', usr, contacts, token);
		});
		socket.broadcast.emit('online', usr);

		console.log(usr.username + ' logged in');
	};

	// recieve a jwt from the client and authenticate them
	socket.on('auth', token => {
		try {
			var decoded = jwt.decode(token, JWT_SECRET);
		} catch (e) {
			return socket.emit('auth_error');
		}

		if (!decoded || !decoded.id || decoded.id == 'undefined') {
			return socket.emit('auth_error');
		}

		// this is optional. you can typicaly assume the token is valid if you prefer and skip this additinal lookup
		db.collection('users').find({
			_id: ObjectId(decoded.id)
		}).toArray((err, data) => {
			if (err) {
				socket.emit('auth_error', 'Error');
				return console.log(err);
			}
			if (!data || !data[0] || !data[0]._id) {
				socket.emit('auth_error', 'Error');
				return console.log('data', data);
			}

			return logUserIn(data[0]);
		});
	});

	// log a client in by credentials
	socket.on('login', function(authUser) {
		if (!authUser) {
			return;
		}
		// if this socket is already connected,
		// send a failed login message
		let currentUser = checkUser();
		if (currentUser) {
			socket.emit('login_error', 'You are already connected.');
			return;
		}

		db.collection('users').find({
			username: authUser.username
		}).toArray((err, data) => {
			if (err) {
				socket.emit('login_error', 'Error');
				return console.log(err);
			}

			if (!data.length) {
				if (!authUser.username || !authUser.password) {
					return socket.emit('login_error', 'Username and Password required');
				}
				bcrypt.hash(authUser.password, 10, (err, hash) => {
					if (err) {
						socket.emit('login_error', 'Error');
						return console.log(err);
					}

					let avatar = (Math.floor(Math.random() * (17 - 1 + 1)) + 1) + '';
					avatar = '00'.substring(0, '00'.length - avatar.length) + avatar;
					db.collection('users').insert({
						name: Name.random(),
						username: authUser.username,
						password: hash,
						image: '1-81-' + avatar + '.svg'
					}, (err, data) => {
						if (err) {
							socket.emit('login_error', 'Error');
							return console.log(err);
						}
						console.log('adding user', data.ops[0]);
						logUserIn(data.ops[0]);
					});
				});
			} else {
				bcrypt.compare(authUser.password, data[0].password, (err, compare) => {
					if (err) {
						return socket.emit('login_error', 'Incorrect username or password');
					}
					logUserIn(data[0]);
				});
			}
		});
	});

	// recieve an event to send a message to another user
	socket.on('message', function(userId, message) {
		let currentUser = checkUser();
		if (!currentUser) return;

		// @todo: add rate limiting

		db.collection('users').find({
			_id: ObjectId(userId)
		}).limit(1).next((err, contact) => {
			if (!contact || !contact._id) {
				console.log('Not a valid user to send to', userId);
				return;
			}
			updateChat(contact);
		});

		var updateChat = contact => {
			// update the chat entry
			// this could probably be cleaned up a bit. seems bloated
			db.collection('chats').find({
				users: {
					$all: [ObjectId(currentUser.id), ObjectId(userId)]
				}
			}).limit(1).next((err, data) => {
				if (err) return console.log(err);

				let complete = chat => {
					addMessage(chat, contact);
				};

				if (data && data._id) {
					db.collection('chats').update(
						{_id: data._id},
						{
							lastDate: new Date,
							lastMessage: message,
							users: data.users,
							startDate: data.startDate
						},
					(err, data) => {
						if (err) return console.log(err);
					});
					return complete(data);
				} else {
					db.collection('chats').insert({
						users: [ObjectId(currentUser.id), ObjectId(userId)],
						startDate: new Date,
						lastDate: new Date,
						lastMessage: message
					}, (err, data) => {
						if (err) return console.log(err);
						complete(data.ops[0]);
					});
				}
			});
		};

		/*
		// was having problems with findAndModify and $all here. doesnt want to play nice

				db.collection('chats').update(
					{
						users: {
							$all: [ObjectId(currentUser.id), ObjectId(userId)]
						}
					},
					{
						lastDate: new Date,
						lastMessage: message,
						$setOnInsert: {startDate: new Date}
					},
					{
						upsert: true
					},
				(err, data) => {
					if (err) return console.log(err);
					console.log(data);
				});
				return;

		db.collection('chats').findAndModify(
			{
				query: {
					users: {
						$all: [currentUser.id, userId]
					}
				}
			},
			[],
			{  $setOnInsert: { date: new Date}},
			{ new: true, upsert: true }
		, (err, data) => {
			console.log(err);
			console.log(data);
		});
		console.log('blah')

		db.chats.findAndModify({
			query: {
				users: {
					$all: ['5883928d07aa6ac2c9259e2f', '5883e821937904e86350fdcf']
				}
			},
			update: {},
			upsert: true
		});
		*/

		var addMessage = (chat, contact) => {
			db.collection('messages').insert({
				to: userId,
				from: currentUser.id,
				date: new Date,
				message: message,
				chat: chat._id
			}, (err, data) => {
				if (err) {
					return console.log(err);
				}
				data = data.ops[0];
				let send = {
					type: 'message',
					data: {
						date: data.date,
						id: data._id + '',
						to: data.to + '',
						from: data.from,
						message: data.message
					}
				};

				// send connection the notification
				let connection = getSocket(contact);
				io.to(connection.socket).emit('messageReceived', currentUser.id, send);
			});
		};
	});

	// get a list of messages for that chat
	socket.on('chat', function(request) {
		let currentUser = checkUser();
		if (!currentUser) return;

		db.collection('messages').find({
			$or: [{
				from: currentUser.id,
				to: request.user
			}, {
				to: currentUser.id,
				from: request.user
			}]
		}).toArray((err, data) => {
			if (err) {
				return console.log(err);
			}

			return socket.emit(request.responseName || 'chat_messages', data);
		});
	});

	// get a list of contacts for the current user
	var getContacts = currentUser => {
		return new Promise((resolve, reject) => {
			db.collection('users').find({

			}).toArray((err, data) => {
				if (err) {
					reject();
					return console.log(err);
				}
				if (!data || !data[0]) {
					resolve([]);
					return;
				}

				db.collection('chats').find({
					users: {$in: [ObjectId(currentUser.id || currentUser._id)]}
				}).toArray((err, chats) => {
					if (err) {
						reject();
						return console.log(err);
					}

					let contacts = data.map(function(contact) {
						let online = false;
						let lastDate = null;
						let lastMessage = null;

						for (let x in chats) {
							let usrs = chats[x].users.map(u => {
								return u.toString()
							});

							if (usrs.indexOf(contact._id.toString()) > -1) {
								lastMessage = chats[x].lastMessage;
								lastDate = chats[x].lastDate;
							}
						}
						for (let x in users) {
							if (users[x].id == contact._id) {
								online = true;
								break;
							}
						}
						return {
							id: contact._id,
							name: contact.name,
							username: contact.username,
							image: contact.image,
							online: online,
							lastMessage: lastMessage,
							lastDate: lastDate
						};
					});
					resolve(contacts);
				});

			/*
				db.collection('messages').aggregate([
					$match: {
						$or: [{
							from: currentUser.id,
						}, {
							to: currentUser.id,
						}]
					},
					$group: []
				}]).toArray((err, data) => {
					if (err) {
						return console.log(err);
					}

					return socket.emit(request.responseName || 'chat_messages', data);
				});
				*/


			});
		});
	};

	// for now, all users are your contacts
	socket.on('contacts', function(userId) {
		let currentUser = checkUser();
		if (!currentUser) return;

		getContacts(currentUser).then(contacts => {
			socket.emit('contacts', contacts);
		});
	});

	// recieve a message to send to another client
	socket.on('sendMessage', function(userId, message) {
		let currentUser = checkUser();
		if (!currentUser) return;

		var contact;
		users.forEach(usr => {
			if (usr.id == userId) {
				contact = usr;
			}
		});

		if (!contact) {
			return;
		}

		console.log('messaging: from ' + currentUser.id + ' to ' + contact.id);
		io.to(contact.socket).emit('messageReceived', currentUser.id, message);
	});

	// remove a connected user from the list of online users
	var disconnect = function() {
		for (var x in users) {
			if (users[x].socket == socket.id) {
				socket.broadcast.emit('offline', users[x].user);
				console.log(users[x].user.username, ' disconnected');
				users.splice(x, 1);
				return;
			}
		}
		console.log(socket.id + ' could not fully disconnect.');
	};

	socket.on('logout', disconnect);
	socket.on('disconnect', disconnect);
});


const port = process.env.PORT || 9000;
http.listen(port, () => {
	console.log('listening on port', port);
});