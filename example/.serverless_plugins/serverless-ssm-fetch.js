'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _bluebird = require('bluebird');

var BbPromise = _interopRequireWildcard(_bluebird);

var _awsSdk = require('aws-sdk');

var _awsSdk2 = _interopRequireDefault(_awsSdk);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var SsmFetch = function () {
  function SsmFetch(serverless, options) {
    var _this = this;

    _classCallCheck(this, SsmFetch);

    this.serverless = serverless;
    this.options = options;

    this.validate();

    this.commands = {
      'serverless-ssm-fetch': {
        commands: {
          parameter: {
            usage: 'Internal use only!',
            lifecycleEvents: ['validate', 'get']
          }
        }
      }
    };

    this.hooks = {
      'after:package:cleanup': function afterPackageCleanup() {
        _this._triggeredFromHook = true;
        return _this.serverless.pluginManager.run(['serverless-ssm-fetch', 'parameter']);
      },
      'serverless-ssm-fetch:parameter:validate': function serverlessSsmFetchParameterValidate() {
        return _this._triggeredFromHook ? BbPromise.resolve() : BbPromise.reject(new Error('Internal use only'));
      },
      'serverless-ssm-fetch:parameter:get': function serverlessSsmFetchParameterGet() {
        return BbPromise.bind(_this).then(_this.getParameter).then(_this.assignParameter);
      }
    };
  }

  _createClass(SsmFetch, [{
    key: 'getParameter',
    value: function getParameter() {
      var _this2 = this;

      return new Promise(function (resolve, reject) {

        _this2.serverless.cli.log('> serverless-ssm-fetch: Get parameters...');

        // Instantiate an AWS.SSM client()
        var ssmClient = new _awsSdk2.default.SSM({ region: _this2.serverless.service.provider.region });

        // Get the SSM Parameters set in serverless.yml
        var ssmParameters = _this2.serverless.service.custom['serverlessSsmFetch'];

        // Init an empty collection of Promises that will be populated by
        // the needed calls to AWS.SSM to get all parameters
        var promiseCollection = [];

        // Make this as self to access it from the following promise
        var self = _this2;

        // Init serverless variable that will store fetched data
        _this2.serverless.variables.serverlessSsmFetch = {};

        // For each SSM parameters to retrieve
        Object.keys(ssmParameters).forEach(function (parameter) {

          // Populate promiseCollection with the request to do to AWS.SSM
          promiseCollection.push(new Promise(function (resolve, reject) {

            // Splits the parameter string to check if encryption is needed or not
            var splitParameterEncryptionOption = ssmParameters[parameter].split('~');

            // Builds AWS.SSM request payload
            var params = {
              Name: splitParameterEncryptionOption[0],
              WithDecryption: splitParameterEncryptionOption[1] == 'true'
            };

            // Triggers the `getParameter`request to AWS.SSM
            ssmClient.getParameter(params, function (err, data) {
              self.serverless.cli.log('> serverless-ssm-fetch: Fetching "' + parameter + ': ' + ssmParameters[parameter] + '" ...');
              if (err) {
                self.serverless.cli.log('> serverless-ssm-fetch: ' + err);
                reject(err);
              } else {
                self.serverless.variables.serverlessSsmFetch[parameter] = data.Parameter.Value;
                resolve(data);
              }
            });
          }));
        });

        // Triggers all `getParameter` queries concurrently
        Promise.all(promiseCollection).then(function (success) {
          _this2.serverless.cli.log('> serverless-ssm-fetch: Get parameters success. Fetched SSM parameters:');
          _this2.serverless.cli.log(JSON.stringify(Object.keys(_this2.serverless.variables.serverlessSsmFetch)));
          return resolve(success);
        }).catch(function (error) {
          _this2.serverless.cli.log('> serverless-ssm-fetch: Get parameter: ERROR');
          _this2.serverless.cli.log(error);
          return reject(error);
        });
      });
    }
  }, {
    key: 'assignParameter',
    value: function assignParameter() {
      var _this3 = this;

      // forEach function to deploy
      Object.keys(this.serverless.service.functions).forEach(function (functionName) {
        // Aliases of the current function path and the got ssm parameters path
        var currentFunction = _this3.serverless.service.functions[functionName];
        var fetchedSsmParameters = _this3.serverless.variables.serverlessSsmFetch;

        if (_this3.isSet(currentFunction.ssmToEnvironment)) {
          // If the property `ssmToEnvironment` has been set at the function level

          // Creates the function `environment` property if it doesn't already exist
          if (!_this3.isSet(currentFunction.environment)) {
            currentFunction.environment = {};
          }

          // forEach ssmParameter assigned over `ssmToEnvironment` function property...
          currentFunction.ssmToEnvironment.forEach(function (ssmParameterToAssign) {
            if (_this3.isSet(fetchedSsmParameters[ssmParameterToAssign])) {
              // merges it into the function `environment` property
              currentFunction.environment[ssmParameterToAssign] = fetchedSsmParameters[ssmParameterToAssign];
            }
          });
        } else {
          // Else, the property `ssmToEnvironment` has NOT been set at the function level

          // Creates the function `environment` property if it doesn't already exist
          if (!_this3.isSet(currentFunction.environment)) {
            currentFunction.environment = {};
          }

          // Merges ALL the fetched ssmParameters
          Object.keys(fetchedSsmParameters).forEach(function (ssmParameterToAssign) {
            currentFunction.environment[ssmParameterToAssign] = fetchedSsmParameters[ssmParameterToAssign];
          });
        }

        _this3.serverless.cli.log('> serverless-ssm-fetch: Function "' + functionName + '" set environment variables: ' + JSON.stringify(Object.keys(currentFunction.environment)));
      });
    }
  }, {
    key: 'validate',
    value: function validate() {
      var _this4 = this;

      setTimeout(function () {
        if (_this4.serverless.service.provider.name !== 'aws') {
          throw new _this4.serverless.classes.Error('> serverless-ssm-fetch: The plugin "serverless-ssm-fetch" is only available for `aws` provider.');
        }

        if (!_this4.isSet(_this4.serverless.service.custom) || !_this4.isSet(_this4.serverless.service.custom['serverlessSsmFetch'])) {
          throw new _this4.serverless.classes.Error('> serverless-ssm-fetch: You are using the plugin "serverless-ssm-fetch". You must set a `custom.serverlessSsmFetch` element in your serverless conf file.');
        }
      }, 5000);
    }
  }, {
    key: 'isSet',
    value: function isSet(attribute) {
      var bool = true;
      if (typeof attribute === 'undefined' || attribute === null) {
        bool = false;
      }
      return bool;
    }
  }]);

  return SsmFetch;
}();

module.exports = SsmFetch;
