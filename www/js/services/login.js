
// managed logged in user

angular.module('VideoChatApp.services')
	.factory('Login', function(Socket, $state, $rootScope, $ionicPopup, $ionicHistory, Audio) {
		var user = null;
		var init = false;
		var playLoginSound = true;

		var exports = {
			user: null,
			// authenticate a user using jwt
			auth: function(force) {
				if (!exports.user) {
					if (!localStorage.getItem('token')) {
						$rootScope.$broadcast('auth', false);
						return exports.go();
					}
				}

				var done = function() {
					Socket.removeListener('auth_error', error);
					Socket.removeListener('login_successful', success);
				};

				var error = function(message) {
					done();
					localStorage.removeItem('token')
					exports.go();
					console.log('error auth.');
				};

				var success = function(user, users) {
					done();
					if (playLoginSound) {
						playLoginSound = false;
						Audio.play('login');
					}
					$rootScope.$broadcast('user.login', {
						user: user,
						users: users
					});
				};

				Socket.emit('auth', localStorage.getItem('token'));
				Socket.on('login_successful', success);
				Socket.on('auth_error', error);
			},
			// go to the login page with no transitions
			go: function() {
				$ionicHistory.nextViewOptions({
					disableAnimate: true,
					disableBack: true
				});
				$state.go('login');
			},
			// perform a login from the log in page
			login: function(user) {
				exports.complete = makeComplete();
				return new Promise(function(resolve, reject) {
					var done = function() {
						Socket.removeListener('login_error', error);
						Socket.removeListener('login_successful', success);
					};

					var error = function(message) {
						var alertPopup = $ionicPopup.alert({
							title: 'Error',
							template: message
						});
						done();
						reject('login fail');
					};

					var success = function(user, users, token) {
						exports.user = user;
						if (token) {
							localStorage.setItem('token', token);
						}
						done();
						$rootScope.$broadcast('user.login', {
							user: user,
							users: users
						});
						if (playLoginSound) {
							playLoginSound = false;
							Audio.play('login');
						}
						resolve();
					};

					Socket.on('login_error', error);
					Socket.on('login_successful', success);
					Socket.emit('login', user);
				});
			},
			// log the user out
			logout: function() {
				playLoginSound = true;
				localStorage.removeItem('token');
				exports.user = null;
				$rootScope.contacts.length = 0;
				$rootScope.$broadcast('user.logout');
				$state.go('login');
				Socket.emit('logout');
				exports.complete = makeComplete();
			}
		};

		// a promise that fires once we have logged in
		// used by controllers
		var makeComplete = function() {
			return new Promise(function(resolve, reject) {
				if (exports.user) {
					resolve(exports.user);
					return;
				}
				var cleanA = $rootScope.$on('user.login', function(e, data) {
					cleanA(); cleanB();
					resolve(data.user);
				});
				var cleanB = $rootScope.$on('auth', function() {
					cleanA(); cleanB();
					reject('auth fail');
				});
			});
		};

		exports.complete = makeComplete();

		// authenticate using jwt once socket is connected
		Socket.on('connect', function(socket) {
			exports.auth();
		});

		// unused
		Socket.on('disconnect', function(socket) {
		});

		// triggered when the user logs in
		$rootScope.$on('user.login', function(e, data) {
			exports.user = data.user;
			user = data;
		});


		return exports;
	});