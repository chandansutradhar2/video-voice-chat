// handles incoming and outgoing text messages

angular.module('VideoChatApp.services')
	.factory('Chat', function(Socket, $rootScope, Contact) {

		// format chat date diffs
		moment.updateLocale('en', {
			relativeTime: {
				future: "now",
				past: "%s",
				s: "now",
				m: "1 m",
				mm: "%dm",
				h: "1 h",
				hh: "%d h",
				d: "1 d",
				dd: "%d d",
				M: "1 m",
				MM: "%d m",
				y: "1 y",
				yy: "%d y"
			}
		});

		// broadcast an event when there is a chat mesasage recieved
		// another way to do this would be to forward the message directly
		Socket.on('messageReceived', function(name, message) {
			switch (message.type) {
				case 'message':
					$rootScope.$broadcast('chat-message', name, message.data);
					break;
			}
		});

		return {
			// get the contacts of a chat using a socket promise
			get: function(userId) {
				return new Promise(function(resolve, reject) {
					Socket.promise('chat', {
						user: userId
					}).then(function(data) {
						resolve(data);
						if (!data || !data.length) return;
						Contact.updateLastMessage(data[data.length - 1].message);
					});
				});
			},
			// send a new message to another contact
			send: function(id, message) {
				// @todo: make a promise so we know when it has fully been sent
				Socket.emit('message', id, message);
			},
			// @todo: typing
			typing: function() {

			}
		};
	});