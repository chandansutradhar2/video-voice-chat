## Development Setup

iOS does not support [WebRTC](https://webrtc.org/) natively, we we use the [cordova-plugin-iosrtc](https://github.com/eface2face/cordova-plugin-iosrtc) plugin. If you run into any issues complaining about bridge headers, or swift versions, you may want to check out their documented on building.

### Install packages

Adding and removing iOS twice is necessary to get all the Xcode settings right.

```sh
npm install
ionic state restore
ionic resources
ionic platform remove ios
ionic platform add ios
ionic prepare
```

### Xcode

1. For iOS, please make sure you are using Xcode 8.
2. Open your project in Xcode
3. When it asks **Convert to Current Swift Syntax** answer
  - **Later**
4. Select your team for your provisioning profile
5. Build!

## Server Setup

The backend requires [Node.js](https://nodejs.org/) and [MongoDB](https://www.mongodb.com/). While developing, you will likely want a local development environment, and when publishing, you will likely want it hosted. While there are many ways to setup either, where are 2 of the easiest.

#### Local Setup

1. Download and install MongoDB for your platform
  - if you are using brew, just type `brew install mongodb`
  - if not, see [https://www.mongodb.com/download-center]
2. You probably already have Node.js, but [Install](https://nodejs.org/en/download/) it if you don't


#### Remote server setup

The easiest way to get rolling with a server is to deploy to Heroku.

1. Signup for Heroku if you have not already
2. Click **New** then **Create new App**
3. Click **Create**
4. In the App settings, go to **Deploy**
5. I recommend using GitHub to deploy rather than Heroku Git. If you need help setting up a GitHub repo, Checkout [GitHub's Docs](https://help.github.com/articles/create-a-repo/)
6. In **Resources**, Add an mLab MongoDB install