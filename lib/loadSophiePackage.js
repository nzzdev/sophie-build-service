const Boom = require('boom')
const fetch = require('node-fetch')
const semver = require('semver')
const btoa = require('btoa')
const tar = require('tar')
const zlib = require('zlib')
const debug = require('debug')('sophie')

const GitHub = require('github-api')
const gh = new GitHub({
   username: process.env.GITHUB_USER_NAME,
   password: process.env.GITHUB_AUTH_TOKEN
})

module.exports = function loadSophiePackage(pack, savePath) {
  debug(`loading package ${pack.name}@${pack.version}`)
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
      throw Boom.badRequest(`no satisfying version found for ${pack.name}@${pack.version}`);
    })
    .then(release => {
      debug(`found satisfiying release ${pack.name}@${release.name}`);
      debug(`going to fetch ${release.tarball_url}`);
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
      debug(`loaded release tarball for ${pack.name}`)
      return new Promise((resolve, reject) => {
        let stream = tarGzStream
          .pipe(zlib.createGunzip())
          .pipe(tar.Extract({
            path: savePath,
            strip: 1
          }))
          .on('error', err => {
            debug(`failed to extract ${pack.name}: ${err}`)
            reject(err);
          })
          .on('end', () => {
            debug(`extracted ${pack.name}`)
            resolve(pack)
          })
      })
    })
}
