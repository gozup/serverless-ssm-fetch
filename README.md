**Serverless SSM Fetch**
================

Serverless SSM Fetch is an **"AWS provider only"** plugin that allows to fetch parameters from AWS Store Parameters and assign them to serverless.yml functions environment variables.

Before using this plugin you must have set your parameters into [AWS System Manager Parameter Store](http://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-paramstore.html)

**NOTE**: to use this plugin, the AWS credentials that you use for your project must have permissions for:
* ssm:Describe*
* ssm:Get*
* ssm:List*

## Versions

* For serverless framework **v2**: use serverless-ssm-fetch@**1.x**
* For serverless framework **v3**: use serverless-ssm-fetch@**2.x**


## Setup

First, you have to set `serverless-ssm-fetch` plugin by running: 
```
serverless plugin install --name serverless-ssm-fetch
```

This will install the required npm package and add the plugin to your `serverless.yml` file.
```yaml
...

plugins:
  - serverless-ssm-fetch

...
```

Then, you must declare the SSM Parameters that must be assigned to your functions environment variables.

It consists in key value pairs, where the key is the environment variable name you want to use, and the value is the parameter path you set in AWS System Manager Parameter Store on your AWS account. Example: `APP_ID: /aws/ssm/parameter/path/app_id`.  

To declare them, use the `serverlessSsmFetch` accessor inside `custom` variable in your `serverless.yml` file. FYI, it also works if you use a nested file for your `custom` (`custom: $(file:./path/to/file)`).  
```yaml
...

custom:
  serverlessSsmFetch:
    APP_ID: /aws/ssm/parameter/path/app_id
    APP_KEY: /aws/ssm/parameter/path/app_key
    APP_SECRET: /aws/ssm/parameter/path/app_secret~true

...
```

## Usage

By default, there is nothing more to do if you want *all* your SSM Parameters injected in *all* your functions.
But of course, you will probably want to assign specific parameters to specific functions. You can specify it on a per function basis this way:
```yaml
...

custom:
  serverlessSsmFetch:
    APP_ID: /aws/ssm/parameter/path/app_id
    APP_KEY: /aws/ssm/parameter/path/app_key
    APP_SECRET: /aws/ssm/parameter/path/app_secret~true

functions:
  hello:
    handler: handler.hello
    ssmToEnvironment:
      - APP_ID
    environment:
      - NODE_ENV: development

...
```
This will add *ONLY* the SSM Parameter `APP_ID` to the function environment variables. In this case, the function `hello` will be pushed to AWS Lambda with environment variables `NODE_ENV` and `APP_ID`.

## Decryption

On AWS Parameters Store you can decide to encrypt parameters when you set them. Meaning that you must decrypt them with your KMS key when you use them within your application.

With `serverless-ssm-fetch` you can decide to decrypt them at runtime to add the decrypted format of the parameter to your environment variable. It is useful if you don't use an AWS KMS key to decrypt parameters within your app.

To decrypt a parameter you just have to add `~true` at the end of your AWS SSM Parameter path:
```yaml
...

custom:
  serverlessSsmFetch:
    APP_SECRET: /aws/ssm/parameter/path/app_secret~true

...
```


## Licensing

MIT License - Copyright © 2017 Emmanuel Lemoine
