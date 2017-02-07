
// handles incoming and outgoing video calls

angular.module('VideoChatApp.services')
	.factory('Call', function($ionicPlatform, Socket, $ionicModal, $rootScope, $stateParams, Contact, Video, $timeout, $sce, Audio) {
		var $scope = $rootScope.$new();

		var maxTimer = 200000;
		$scope.facing = 'front';

		var pickupTimeout = null;
		$scope.contactName = null;
		$scope.isInCall = false;
		$scope.isCalling = false;
		$scope.isAnswering = false;

		var duplicateMessages = [];
		$scope.muted = false;
		$scope.lastState = null;

		// place a new call
		var triggerCall = function(contact) {
			Audio.play('calling');
			showModal();
			if ($scope.isInCall) {
				return;
			}

			preview();

			pickupTimeout = $timeout(function() {
				console.log('Call took too long to pick up. Ending.');
				$scope.endCall();
			}, maxTimer);

			console.debug('calling ', contact);
			$scope.contact = Contact.get(contact);
			$scope.contactName = contact;
			$scope.isCalling = true;
			Socket.emit('sendMessage', contact, {
				type: 'call'
			});
		};

		$rootScope.triggerCall = triggerCall;

		// open the call modal
		var showModal = function() {
			$rootScope.modal.show();
			$rootScope.modalShowing = true;
		};

		$ionicModal.fromTemplateUrl('templates/call.html', {
			scope: $scope
		}).then(function(modal) {
			$rootScope.modal = modal;
		});

		$scope.$on('modal.hidden', function() {
			$rootScope.modalShowing = false;
		});

		// publicly accessable methods
		var exports = {
			scope: $scope,
			call: triggerCall
		};

		var localStream;
		var peerConnection;

		// ice servers get around routers and firewalls
		var peerConnectionConfig = {
			'iceServers': [{
				'url': 'stun:stun.services.mozilla.com'
			}, {
				'url': 'stun:stun.l.google.com:19302'
			}]
		};

		var gotDescription = function(description) {
			console.log('got description', $scope.contactName);
			peerConnection.setLocalDescription(description, function() {
				Socket.emit('sendMessage', $scope.contactName, {
					'sdp': description
				});
			}, function() {
				console.log('set description error')
			});
		}

		var gotIceCandidate = function(event) {
			if (event.candidate != null) {
				Socket.emit('sendMessage', $scope.contactName, {
					'ice': event.candidate
				});
			}
		}

		var gotRemoteStream = function(event) {
			console.log('got remote stream');
			$scope.remoteVideo = $sce.trustAsResourceUrl(window.URL.createObjectURL(event.stream));
		}

		Socket.on('messageReceived', function(name, message) {
			console.debug('Message', message);

			switch (message.type) {
				case 'call':
					console.debug('incoming call...', message);

					if ($scope.isCalling) {
						// we are trying to call eachother. just answer it automaticly
						if ($scope.contactName == name) {
							$scope.$apply(function() {
								$timeout.cancel(pickupTimeout);
								pickupTimeout = null;
								$scope.isCalling = false;
								$scope.isAnswering = true;
								$scope.answer();
							});
							return;
						}

						// ignore this incoming call if we are busy
						$scope.ignore(false, name);
						return;
					}

					Audio.play('calling');

					pickupTimeout = $timeout(function() {
						console.log('Call took too long to pick up. Ending.');
						$scope.endCall();
					}, maxTimer);

					// start a new call
					$scope.$apply(function() {
						$scope.contact = Contact.get(name);
						$scope.contactName = name;
						$scope.isAnswering = true;
						showModal();
						preview();
						refreshVideos()
					});
					break;

				case 'answer':
					$timeout.cancel(pickupTimeout);
					pickupTimeout = null;

					$scope.$apply(function() {
						$scope.isInCall = true;
						$scope.isCalling = false;
						refreshVideos();
					});

					call(true, $scope.contactName);
					break;

				case 'ignore':
				case 'cancel':
					$scope.endCall();
					break;

				case 'end':
					if ($scope.isInCall || $scope.isCalling || $scope.isAnswering) {
						$scope.endCall();
					}
					break;

				case 'phonertc_handshake':
					if (duplicateMessages.indexOf(message.data) === -1) {
						$scope.Contact[name].receiveMessage(JSON.parse(message.data));
						duplicateMessages.push(message.data);
					}

					break;

			}

			if (message.sdp) {
				peerConnection.setRemoteDescription(new RTCSessionDescription(message.sdp), function() {
					if (message.sdp.type == 'offer') {
						peerConnection.createAnswer(gotDescription, function(e) {
							console.log('error creating answer', e);
						});
					}
				});
			} else if (message.ice) {
				peerConnection.addIceCandidate(new RTCIceCandidate(message.ice));
			}
		});

		$scope.hideCall = function() {
			$scope.modal.hide();
			refreshVideos()
		};

		// a hacky way to make sure we get the latest video position reguardless of animations or transitions
		// another way might be to use iosrtc.observeVideo(video) or an $interval
		var refreshVideos = function() {
			try {
				for (var x = 0; x <= 3000; x+=300) {
					console.log(x)
					$timeout(cordova.plugins.iosrtc.refreshVideos,x);
				}
			} catch (e) {
				console.log(e);
			}
		};

		// end the call in either direction
		$scope.endCall = function() {
			if (peerConnection) {
				peerConnection.close();
			}

			$scope.localVideo = null;
			$scope.remoteVideo = null;
			$scope.isAnswering = false;
			$scope.isCalling = false;
			$scope.isInCall = false;
			localStream = null;

			Video.disconnect().then(function() {
				$scope.modal.hide();
				refreshVideos();
			});

			$timeout(function() {
				Socket.emit('sendMessage', $scope.contactName, {
					type: 'end'
				});
			});

			$scope.contactName = null;
			$scope.contact = null;
		};

		// add local stream
		var addStream = function(stream, timeout) {
			localStream = stream;
			$timeout(function() {
				$scope.localVideo = $sce.trustAsResourceUrl(window.URL.createObjectURL(stream));
			}, timeout || 0);
		}

		// preview local video as full screen
		var preview = function() {
			Video.connect(true, true).then(function(stream) {
				addStream(stream,10);
			});
		};

		// begin a call using webrtc
		var call = function(isInitiator, contactName) {
			console.log(new Date().toString() + ': calling to ' + contactName + ', isInitiator: ' + isInitiator);

			var connect = function() {
				peerConnection = new RTCPeerConnection(peerConnectionConfig);

				peerConnection.onicecandidate = gotIceCandidate;
				peerConnection.onaddstream = gotRemoteStream;
				peerConnection.oniceconnectionstatechange = function(event) {
					$scope.lastState = event.target.iceConnectionState;
					console.debug('ice state', $scope.lastState);
					if ($scope.lastState === 'failed' || $scope.lastState === 'disconnected' || $scope.lastState === 'closed') {
						peerConnection = null;
						$scope.endCall();
					}
				};
				peerConnection.addStream(localStream);

				if (isInitiator) {
					//$scope.isCalling = true;
					console.debug('creating offer');
					peerConnection.createOffer(gotDescription, function(e) {
						console.log('error creating offer', e)
					});
				} else {
					//$scope.isAnswering = true;
				}
			};

			if (!localStream) {
				Video.connect(true, true).then(function(stream) {
					addStream(stream, 1000);
					connect();
				});
			} else {
				connect();
			}

			return;
			/*
						session.on('sendMessage', function(data) {
							Socket.emit('sendMessage', contactName, {
								type: 'phonertc_handshake',
								data: JSON.stringify(data)
							});
						});

						$scope.Contact[contactName] = session;
						*/
		}

		// cancel a call being placed
		$scope.cancel = function() {
			Socket.emit('sendMessage', $scope.contactName, {
				type: 'cancel'
			});
			$scope.endCall();
		};

		// ignore an incomming call
		$scope.ignore = function(end, name) {
			Socket.emit('sendMessage', name || $scope.contactName, {
				type: 'ignore'
			});
			if (!end) return;
			$scope.endCall();
		};

		// answer in incoming call
		$scope.answer = function() {
			if ($scope.isInCall) {
				return;
			}

			$timeout.cancel(pickupTimeout);
			pickupTimeout = null;

			$scope.isInCall = true;
			$scope.isAnswering = false;
			call(false, $scope.contactName);

			$timeout(function() {
				Socket.emit('sendMessage', $scope.contactName, {
					type: 'answer'
				});
			});
			refreshVideos();
		};

		// swap the camera facing. defaults to front facing to start
		$scope.toggleFacing = function() {
			$scope.facing = $scope.facing == 'front' ? 'back' : 'front';

			Video.connect(!$scope.muted, true, $scope.facing).then(function(stream) {
				console.debug('using new facing stream', stream);
				addStream(stream);
				peerConnection.addStream(localStream);
			});
		};

		// mute the microphone and attach a new stream to connection
		// note: doesnt seem to work quite right on all brwosers
		$scope.toggleMute = function() {
			$scope.muted = !$scope.muted;
			console.debug(($scope.muted ? '' : 'un') + 'muting...');

			if ($scope.muted) {
				Video.mute(!$scope.muted);
			} else {
				Video.unmute().then(function(stream) {
					console.debug('using muted stream', stream);
					addStream(stream);
					peerConnection.addStream(localStream);
				});
			}
		};

		return exports;
	});