
// angular socket wrapper for socket.io

angular.module('VideoChatApp.services')
	.factory('Socket', function(socketFactory, $timeout) {

		// connect to our server
		var socket = io.connect('http://192.168.0.214:9000/');

		var socketFactory = socketFactory({
			ioSocket: socket
		});

		// generate a unique custom request id
		var makeId = function(len) {
			var text = '';
			var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789$';
			for (var i = 0; i < (len || 10); i++) {
				text += possible.charAt(Math.floor(Math.random() * possible.length));
			}
			return text;
		}

		// send an event and get a response back
		socketFactory.promise = function(eventName, request) {
			return new Promise(function(resolve, reject) {

				var success = function(response) {
					console.debug(eventName + '|' + request.responseName + ': complete!');
					socketFactory.removeListener(request.responseName, success);
					resolve(response);
				};

				request.responseName = '$response$' + makeId() + '$';
				console.debug(eventName + '|' + request.responseName + ': Sending socket promise...');
				socketFactory.on(request.responseName, success);
				socketFactory.emit(eventName, request);
			});
		};

		return socketFactory;
	})