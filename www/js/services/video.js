angular.module('VideoChatApp.services')
	.factory('Video', function(Socket) {
		var localStream = null;

		return {
			connect: function(audio, video, facing) {
				var self = this;
				console.debug('getting stream', audio, video);
				return new Promise(function(resolve, reject) {
					var connect = function() {
						var videoOptions = {};

						if (window.device && window.device.platform === 'iOS') {
							if (facing == 'front') {
								videoOptions.deviceId = 'com.apple.avfoundation.avcapturedevice.built-in_video:1';
							} else if (facing == 'back') {
								videoOptions.deviceId = 'com.apple.avfoundation.avcapturedevice.built-in_video:0';
							}
						}

						navigator.getUserMedia({
								audio: audio ? true : false,
								video: video ? videoOptions : false
							},
							function(stream) {
								console.log('got local MediaStream: ', stream, stream.getTracks());
								localStream = stream;
								resolve(stream);
							},
							function(error) {
								console.error('getUserMedia failed: ', error);
								reject();
							}
						)
					};
					var getDevices = function() {
						navigator.mediaDevices.enumerateDevices().then(function(data) {

						});
					};
					if (localStream) {
						self.disconnect().then(connect);
					} else {
						connect();
					}
				});
			},
			devices: function() {
				return new Promise(function(resolve, reject) {
					navigator.mediaDevices.enumerateDevices().then(function(devices) {
						resolve(devices);
					});
				});
			},
			mute: function() {
				return new Promise(function(resolve, reject) {
					if (localStream) {
						var tracks = localStream.getAudioTracks();
						for (var x in tracks) {
							tracks[x].enabled = false;
						}
					}
					resolve(localStream);
				});
			},
			unmute: function() {
				var self = this;
				return new Promise(function(resolve, reject) {
					self.connect(true, true).then(function(stream) {
						resolve(stream);
					});
				});
			},
			disconnect: function() {
				return new Promise(function(resolve, reject) {
					if (localStream) {
						var tracks = localStream.getTracks();
						for (var x in tracks) {
							tracks[x].stop();
						}
						console.debug('stoping stream', localStream.getTracks());
						localStream = null;
					}
					resolve();
				});
			}
		};
	});