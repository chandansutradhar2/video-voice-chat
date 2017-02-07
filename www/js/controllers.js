
// controllers for each app state

angular.module('VideoChatApp.controllers', [])

	// login form
	.controller('LoginCtrl', function($scope, Login, Video, Socket, $ionicPopup, $state, $timeout, Contact) {
		$scope.data = {};
		var focus = false;

		$scope.blur = function() {
			if (window.outerHeight > 800) {
				return;
			}
			focus = false;
			$timeout(function() {
				if (!focus) {
					$scope.input = false;
				}
			},300);
		}

		$scope.focus = function() {
			if (window.outerHeight > 800) {
				return;
			}
			focus = true;
			$scope.input = true;
		}

		// forward to chats if we are already logged in
		Login.complete.then(function(user) {
			if (user.id) {
				$state.go('chats');
			}
		});

		// begin the login
		$scope.login = function() {
			Login.login($scope.data).then(function(data) {
				Login.user = $scope.data.name;
				$state.go('chats');
			}, function(data) {
				console.log(data);
			});
		};
	})

	// contacts / chats list state
	.controller('ChatsCtrl', function($scope, $rootScope, $ionicPopup, $state, Contact, Login, Video, Call) {

		Login.complete.then(function(user) {
			if (!user.id) {
				Login.go();
			}
		}, function() {
			Login.go();
		});

		// tap and hold contact card
		$scope.contactCard = function(contact) {
			$scope.contact = contact;
			var alertPopup = $ionicPopup.alert({
				title: contact.name || contact.username,
				scope: $scope,
				templateUrl: 'templates/contact-card.html',
				buttons: [{
					type: 'button-default',
					text: 'OK'
				},{
					type: 'button-positive',
					text: 'Text',
					onTap: function() {
						$state.go('chat-detail', {chatId: contact.id});
					}
				},{
					type: 'button-balanced',
					text: 'Video',
					onTap: function() {
						Call.call(contact.id);
					}
				}]
			});
		};
	})

	// chat detail state
	.controller('ChatDetailCtrl', function($scope, $stateParams, $state, $ionicHistory, Chat, Contact, $scope, Login, $rootScope, Call, $ionicScrollDelegate, $timeout, Audio) {
		//$scope.$on('$ionicView.enter', function(e) {

		// if we refreshed on this page, then go back to chats
		if (!Login.user) {
			$ionicHistory.nextViewOptions({
				disableAnimate: true,
				disableBack: true
			});
			$state.go('chats');
			return;
		}

		$scope.animateChat = false;

		var sending = false;
		var clean = [];
		$scope.messages = [];
		$scope.data = {
			message: null
		};
		$scope.contact = Contact.get($stateParams.chatId);

		// keep the input focused.
		// for some reason it works best if this is separate from the send function
		$scope.blurInput = function() {
			if (!sending) {
				return;
			}
			$timeout(function() {
				document.getElementById('messageBox').focus();
			},10);
			$timeout(function() {
				document.getElementById('messageBox').focus();
			},1);
			document.getElementById('messageBox').focus();
		};

		// scroll the container when there is a new message
		var scroll = function(animate) {
			$ionicScrollDelegate.$getByHandle('chatDetail').scrollBottom(animate);
		};

		// get chat details
		Chat.get($stateParams.chatId).then(function(data) {
			if (data && data.length) {
				data.map(function(m) {
					$scope.messages.push(m);
				});
			}

			scroll(false);
			$timeout(function() {
				scroll(false);
			});
			$timeout(function() {
				$scope.animateChat = true;
			},1);
		});

		// send a message
		$scope.send = function() {
			if (!$scope.data.message) {
				console.debug('no message');
				return;
			}

			sending = true;

			console.debug('Sending message ', $scope.data.message)
			Audio.play('message-sent');
			Chat.send($stateParams.chatId, $scope.data.message);
			$scope.messages.push({
				message: $scope.data.message,
				from: Login.user.id
			});

			scroll(true);
			Contact.updateLastMessage($stateParams.chatId, $scope.data.message);
			$scope.data.message = null;

			$timeout(function() {
				sending = false;
			},100)
		};

		// initilize a call
		$scope.call = function() {
			Call.call($scope.contact.id);
		};

		// watch for incoming chat events and add it to the cleanup queue
		clean.push($rootScope.$on('chat-message', function(e, name, data) {
			if (data.from == $stateParams.chatId) {
				$scope.messages.push(data);
				scroll(true);
				Audio.play('message-received-front');
			} else {
				Audio.play('message-received-back');
			}
		}));

		// cleanup watch events
		clean.map(function(c) {
			$scope.$on('$destroy', c);
		});
		//});
	})

	// user account management page
	.controller('AccountCtrl', function($scope, $rootScope, Login) {
		var clean = $rootScope.$on('user.login', function(e, data) {
			$scope.user = Login.user;
		});
		$scope.user = Login.user;
		$scope.logout = Login.logout;
		$scope.$on('$destroy', clean);
	});