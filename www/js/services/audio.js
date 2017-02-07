
// manages audio for both native plugin and web view

angular.module('VideoChatApp.services')
	.factory('Audio', function($ionicPlatform, $timeout) {
		var audio = [];
		// set the volume here
		var volume = .4;

		// promise that only fires after all files have loaded
		var ready = new Promise(function(resolve, reject) {
			$ionicPlatform.ready(function() {
				var files = ['login','message-received-back','message-received-front','message-sent','calling'];
				var c = 1;

				if (window.plugins && window.plugins.NativeAudio) {
					files.forEach(function(file) {
						window.plugins.NativeAudio.preloadComplex(file, 'audio/' + file + '.mp3', volume, 1, 0, function(msg) {
							c++;
							if (c == files.length) {
								$timeout(resolve, 100);
							}
						}, function(msg) {
							reject();
							console.debug('ERROR loading sound: ' + msg);
						});
					});
				} else {
					files.forEach(function(file) {
						audio[file] = new Audio('audio/' + file + '.mp3');
						audio[file].volume = volume;
					});
					resolve();
				}
			});
		});

		ready.then(function() {
			console.debug('Audio initilized.');
		});

		return {
			// play audio but only if we are ready
			// this is useful for when we first start the app to play a welcome clip
			play: function(clip) {
				ready.then(function() {
					if (window.plugins && window.plugins.NativeAudio) {
						window.plugins.NativeAudio.play(clip);
					} else if (audio[clip]) {
						audio[clip].play();
					}
				});
			}
		};
	});