// our reusable directives

angular.module('VideoChatApp.directives', [])

	// displays the users icon based on contact info
	.directive('user', function(Login, Contact, $timeout, $rootScope) {
		return {
			restrict: 'A',
			link: function($scope, element, attrs) {
				var check = function() {
					if (Login.user && attrs.user == Login.user.id) {
						return element[0].src = 'img/avatar/' + Login.user.image;
					}
					for (var x in $rootScope.contacts) {
						if ($rootScope.contacts[x].id == attrs.user) {
							return element[0].src = 'img/avatar/' + $rootScope.contacts[x].image;
						}
					}
					return false;
				}
				if (!check()) {
					$timeout(check, 1000);
				}
			}
		}
	})

	// adds first of that contact so we dont have to show their icon each time
	.directive('messages', function(Login, Contact, $timeout) {
		return {
			restrict: 'A',
			link: function($scope, element, attrs) {
				$scope.$watchCollection('messages', function() {
					var prev = null;
					for (var x in $scope.messages) {
						if ($scope.messages[x].from != prev) {
							prev = $scope.messages[x].from;
							$scope.messages[x].first = true;
						}
					}
				});
			}
		}
	});