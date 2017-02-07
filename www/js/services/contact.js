
// manages contacts online status

angular.module('VideoChatApp.services')
	.factory('Contact', function(Socket, $rootScope) {
		var userId = null;
		$rootScope.contacts = [];

		// sort contacts by online and last message
		var sortContacts = function(a, b) {
			if (!a) {
				return -1;
			}
			if (!b) {
				return 1;
			}
			if (a.online > b.online) {
				return -1;
		    }
		    if (a.online < b.online) {
				return 1;
		    }
			if (new Date(a.lastDate) > new Date(b.lastDate)) {
				return -1;
		    }
		    if (new Date(a.lastDate) < new Date(b.lastDate)) {
				return 1;
		    }
		    return 0;
		};

		// set online users
		var setOnlineUsers = function(contacts) {
			for (var x in contacts) {
				if (contacts[x].id == userId) {
					continue;
				}
				var add = true;
				for (var xx in $rootScope.contacts) {
					if ($rootScope.contacts[xx].id == contacts[x].id) {
						// dont overwirte fields with empty data
						for (var xxx in contacts[x]) {
							$rootScope.contacts[xx][xxx] = contacts[x][xxx];
						}
						add = false;
						break;
					}
				}
				if (add) {
					$rootScope.contacts.push(contacts[x]);
				}
			}
			$rootScope.contacts.sort(sortContacts);
			$rootScope.$apply();
		};

		var exports = {
			// update the last message send for the chats view
			updateLastMessage: function(id, message) {
				for (var x in $rootScope.contacts) {
					if ($rootScope.contacts[x].id == id) {
						$rootScope.contacts[x].lastMessage = message;
						$rootScope.contacts[x].lastDate = new Date;
						break;
					}
				}
				$rootScope.contacts.sort(sortContacts);
			},

			// get a contact and its details
			get: function(id) {
				for (var x in $rootScope.contacts) {
					if ($rootScope.contacts[x].id == id) {
						return $rootScope.contacts[x];
					}
				}
				return {
					id: id
				};
			}
		};

		// triggered when a contact comes online
		Socket.on('online', function(contact) {
			contact.online = true;
			setOnlineUsers([contact]);
		});

		// triggered when a contact goes offline
		Socket.on('offline', function(contact) {
			contact.online = false;
			setOnlineUsers([contact]);
		});

		// triggered when we request new contacts
		// use Socket.emit('contacts')
		Socket.on('contacts', function(contacts) {
			setOnlineUsers(contacts);
		});

		// triggered on a new incoming message
		$rootScope.$on('chat-message', function(e, name, data) {
			exports.updateLastMessage(name, data.message);
		});

		// triggered after a successfull login
		$rootScope.$on('user.login', function(e, data) {
			userId = data.user.id;
			setOnlineUsers(data.users);
		});

		// triggeres after a logout event
		// note: this does not break the socket connection
		$rootScope.$on('user.logout', function() {
			userId = null;
		});

		return exports;
	});