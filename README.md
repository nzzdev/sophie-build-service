# Sophie Service
Served for the public through: https://service.sophie.nzz.ch

![Sophie Architecture](public/system-overview.png)

# Deployment
This is running on our internal Rancher hosts and publicly served through keycdn.
You need to define GITHUB_USER_NAME and GITHUB_AUTH_TOKEN as env variables to make this work.

# Development
There is a test coverage of 100%. This should stay like this. Make sure to write tests for your feature.

## develop sophie modules
Have a look in the tests for mocked modules implementing what is currently supported by the build service. Pull Requests for more doc are always welcome.