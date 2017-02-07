
// browser compatability for web views
navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia;
window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;

// our main video chat app
angular.module('VideoChatApp', ['ionic', 'ngResource', 'VideoChatApp.controllers', 'VideoChatApp.services',  'VideoChatApp.directives', 'btford.socket-io', 'angularMoment'])

	.run(function($ionicPlatform, Socket, Call, Contact, Chat, $ionicModal, $rootScope, Audio, Login) {
		$rootScope.$on('$stateChangeSuccess', function ($event, toState) {

			// set the state to rootscope for custom page styling
			$rootScope.state = toState.name.replace('.','_');

			// setup the keyboard with different settings for differnt states
			if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
				switch ($rootScope.state) {
					case 'login':
						cordova.plugins.Keyboard.hideKeyboardAccessoryBar(false);
						cordova.plugins.Keyboard.disableScroll(true);
						break;
					case 'chat-detail':
					default:
						cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
						cordova.plugins.Keyboard.disableScroll(true);
						break;
				}
			}
		});

		$ionicPlatform.ready(function() {
			// optional: set statusbar color. org.apache.cordova.statusbar required
			if (window.StatusBar) {
				StatusBar.styleBlackTranslucent();
			}

			// register the global webrtc functions from iosrtc
			if (window.device && window.device.platform === 'iOS') {
				cordova.plugins.iosrtc.registerGlobals();
			}
		});

	})

	.config(function($stateProvider, $urlRouterProvider) {

		// the different states of our app
		$stateProvider
			.state('login', {
				url: '/login',
				controller: 'LoginCtrl',
				templateUrl: 'templates/login.html'
			})
			.state('chats', {
				url: '/chats',
				controller: 'ChatsCtrl',
				templateUrl: 'templates/chats.html'
			})
			.state('chat-detail', {
				url: '/chats/:chatId',
				controller: 'ChatDetailCtrl',
				templateUrl: 'templates/chat-detail.html'
			})
			.state('account', {
				url: '/account',
				controller: 'AccountCtrl',
				templateUrl: 'templates/account.html'
			});

		// if none of the above states are matched, use this as the fallback
		$urlRouterProvider.otherwise('/chats');

	});

// initialize services here
angular.module('VideoChatApp.services', []);