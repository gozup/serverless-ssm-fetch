'use strict';

import * as BbPromise from 'bluebird';
import AWS from 'aws-sdk';

class SsmFetch {

  constructor(serverless, options) {

    this.serverless = serverless;
    this.options = options;

    this.validate();

    this.commands = {
      'serverless-ssm-fetch': {
        commands: {
          parameter: {
            usage: 'Internal use only!',
            lifecycleEvents: [
              'validate',
              'get'
            ]
          }
        }
      }
    };

    this.hooks = {
      'after:package:cleanup': () => {
        this._triggeredFromHook = true;
        return this.serverless.pluginManager.run(['serverless-ssm-fetch', 'parameter'])
      },
      'serverless-ssm-fetch:parameter:validate': () => this._triggeredFromHook ? BbPromise.resolve() : BbPromise.reject(new Error('Internal use only')),
      'serverless-ssm-fetch:parameter:get': () => BbPromise.bind(this)
          .then(this.getParameter)
          .then(this.assignParameter)
    }
  }

  getParameter() {

    return new Promise((resolve, reject) => {

      this.serverless.cli.log('> serverless-ssm-fetch: Get parameters...');

      // Instantiate an AWS.SSM client()
      let ssmClient = new AWS.SSM({region: this.serverless.service.provider.region});

      // Get the SSM Parameters set in serverless.yml
      let ssmParameters = this.serverless.service.custom['serverlessSsmFetch'];

      // Init an empty collection of Promises that will be populated by
      // the needed calls to AWS.SSM to get all parameters
      let promiseCollection = [];

      // Make this as self to access it from the following promise
      let self = this;

      // Init serverless variable that will store fetched data
      this.serverless.variables.serverlessSsmFetch = {};

      // For each SSM parameters to retrieve
      Object.keys(ssmParameters).forEach((parameter) => {

        // Populate promiseCollection with the request to do to AWS.SSM
        promiseCollection.push(new Promise((resolve, reject) => {

          // Splits the parameter string to check if encryption is needed or not
          let splitParameterEncryptionOption = ssmParameters[parameter].split('~');

          // Builds AWS.SSM request payload
          let params = {
            Name: splitParameterEncryptionOption[0],
            WithDecryption: (splitParameterEncryptionOption[1] == 'true')
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
      Promise.all(promiseCollection)
          .then((success) => {
            this.serverless.cli.log('> serverless-ssm-fetch: Get parameters success. Fetched SSM parameters:');
            this.serverless.cli.log(JSON.stringify(Object.keys(this.serverless.variables.serverlessSsmFetch)));
            return resolve(success);
          })
          .catch((error) => {
            this.serverless.cli.log('> serverless-ssm-fetch: Get parameter: ERROR');
            this.serverless.cli.log(error);
            return reject(error);
          });

    });

  }

  assignParameter() {

    // forEach function to deploy
    Object.keys(this.serverless.service.functions).forEach((functionName) => {
      // Aliases of the current function path and the got ssm parameters path
      let currentFunction = this.serverless.service.functions[functionName];
      let fetchedSsmParameters = this.serverless.variables.serverlessSsmFetch;

      if (this.isSet(currentFunction.ssmToEnvironment)) {
        // If the property `ssmToEnvironment` has been set at the function level

        // Creates the function `environment` property if it doesn't already exist
        if (!this.isSet(currentFunction.environment)) {
          currentFunction.environment = {};
        }

        // forEach ssmParameter assigned over `ssmToEnvironment` function property...
        currentFunction.ssmToEnvironment.forEach((ssmParameterToAssign) => {
          if (this.isSet(fetchedSsmParameters[ssmParameterToAssign])) {
            // merges it into the function `environment` property
            currentFunction.environment[ssmParameterToAssign] = fetchedSsmParameters[ssmParameterToAssign];
          }
        })

      } else {
        // Else, the property `ssmToEnvironment` has NOT been set at the function level

        // Creates the function `environment` property if it doesn't already exist
        if (!this.isSet(currentFunction.environment)) {
          currentFunction.environment = {};
        }

        // Merges ALL the fetched ssmParameters
        Object.keys(fetchedSsmParameters).forEach((ssmParameterToAssign) => {
          currentFunction.environment[ssmParameterToAssign] = fetchedSsmParameters[ssmParameterToAssign];
        })

      }

      this.serverless.cli.log('> serverless-ssm-fetch: Function "' + functionName + '" set environment variables: ' + JSON.stringify(Object.keys(currentFunction.environment)));

    });

  }

  validate() {
    setTimeout(() => {
      if (this.serverless.service.provider.name !== 'aws') {
        throw new this.serverless.classes.Error('> serverless-ssm-fetch: The plugin "serverless-ssm-fetch" is only available for `aws` provider.');
      }

      if (!this.isSet(this.serverless.service.custom) || !this.isSet(this.serverless.service.custom['serverlessSsmFetch'])) {
        throw new this.serverless.classes.Error('> serverless-ssm-fetch: You are using the plugin "serverless-ssm-fetch". You must set a `custom.serverlessSsmFetch` element in your serverless conf file.');
      }
    }, 5000);
  }

  isSet(attribute) {
    let bool = true;
    if (typeof attribute === 'undefined' || attribute === null) {
      bool = false;
    }
    return bool;
  }


}

module.exports = SsmFetch;
