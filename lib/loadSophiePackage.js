'use strict';

const fetch = require('node-fetch')
const semver = require('semver')
const btoa = require('btoa')
const tar = require('tar')
const zlib = require('zlib')

const GitHub = require('github-api')
const gh = new GitHub({
   username: process.env.GITHUB_USER_NAME,
   password: process.env.GITHUB_AUTH_TOKEN
})


const loadSophiePackage = function(pack, savePath) {
  let repo = gh.getRepo('nzzdev', pack.name)
  return repo.listReleases()
    .then(response => {
      return response.data
    })
    .then(releases => {
      for (let release of releases) {
        if (semver.satisfies(release.tag_name, pack.version)) {
            return release;
        }
      }
    })
    .then(release => {
      return fetch(release.tarball_url, {
        headers: {
          'Authorization': 'Basic ' + btoa(`${process.env.GITHUB_USER_NAME}:${process.env.GITHUB_AUTH_TOKEN}`),
        }
      })
    })
    .then(response => {
      if (!response.ok) {
        throw response.statusText
      }
      return response.body
    })
    .then(tarGzStream => {
      return new Promise((resolve, reject) => {
        let stream = tarGzStream
          .pipe(zlib.createGunzip())
          .pipe(tar.Extract({
            path: savePath,
            strip: 1
          }))
          .on('error', err => reject(err))
          .on('end', () => resolve(pack))
      })
    })
}

module.exports = loadSophiePackage;
