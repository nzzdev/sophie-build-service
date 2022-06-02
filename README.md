## Sophie Service [![Build Status](https://travis-ci.com/nzzdev/sophie-build-service.svg?branch=dev)](https://travis-ci.com/nzzdev/sophie-build-service)

**Maintainer**: [Nicolas Staub](https://github.com/fromdusttilldawn)

Served for the public through: https://service.sophie.nzz.ch

![Sophie Architecture](public/system-overview.png)

# Deployment

This is running on our internal Rancher hosts and publicly served through keycdn.
You need to define GITHUB_USER_NAME and GITHUB_AUTH_TOKEN as env variables to make this work.
You also need to set APP_ENV to 'staging' or 'production'.

## Logging

Logging is configured with a json. Logging is configured that if the connection is lost, it tries to re-establish the connection.

# Development

Sophie modules follow this versioning scheme: `public-bc.internal-bc.feature` for example `1.2.0` where

- `public-bc`: bumped if there is a bc breaking change in the public styles (css or json) of the package (e.g. things removed, drastic changes)
- `internal-bc`: bumped if there is a change in the internal structure that could make depending sophie modules break
- `feature`: bumped in all other cases e.g. a thing is added without changing existing structure

This enables usage like this:

- bundles are requested with the first number pinned e.g. sophie-color@1
- internal dependencies (see below) are pinned to the second number eg. sophie-color@1.1

Try to not bump `public-bc` for as long as possible (this should be years) as everything using this version should eventually be updated or the version should be maintained and adapted to context redesigns (e.g. nzz.ch gets a redesign) to make old stuff match the new style.

## sophie bundle config

Add a property `sophie` to your package.json that looks like this to depend on other packages. You can then import things from these packages.
See tests for examples.

```
"sophie": {
  "dependencies": {
    "sophie-nzzas-font": "1.1.x",
    "sophie-nzzas-color": "1.0.x"
  }
}
```

# Routes

This service has the following routes:
- GET /bundle/`{bundleId}`.css
- GET /bundle/`{bundleId}`.vars.json

`{bundleId}`: Comma separated string of Sophie modules.

## Example CSS

```
GET /bundle/sophie-color@1,sophie-viz-color@1[gender].css
```

This returns all the [CSS from the module *sophie-color*](https://github.com/nzzdev/sophie-color/tree/master/scss), but only the [CSS from the submodule *gender* from the module *sophie-viz-color*](https://github.com/nzzdev/sophie-viz-color/blob/master/scss/gender.scss). The `@1` sets the version of the Sophie module, from which we want to get the CSS from (in this case we want the newest changes from major version 1).

The response for this example would be:

```css
.s-color-gray-1 {
  color: #f0f0f2
}
.s-color-gray-2 {
  color: #e3e4e9
}
.s-color-gray-3 {
  color: #d4d6dd
}
...
.s-viz-color-male-light {
  color: #7dd1c3
}
.s-viz-color-female {
  color: #6c43c0
}
.s-viz-color-female-light {
  color: #aa90de
}
```

## Example JSON

```
GET /bundle/sophie-color@1.vars.json
```

This returns all the [CSS variables from the module *sophie-color*](https://github.com/nzzdev/sophie-color/tree/master/vars) as an object.

The response for this example would be:

```json
{
  "sophie-color":
  {
    "general":
    {
      "s-color-gray-1": "#f0f0f2",
      "s-color-gray-2": "#e3e4e9",
      ...
      "s-color-positive": "#46d38e",
      "s-color-negative": "#e74e4b"
    }
  }
}
```

# Bundling

## Example CSS

```
GET /bundle/sophie-color@1,sophie-viz-color@1[gender].css
```
First, we split the `bundleId` string into an array of packages:

```javascript
[
  { name: 'sophie-color', version: '1', submodules: undefined },
  { name: 'sophie-viz-color', version: '1', submodules: [ 'gender' ] }
]
```

Then, we download the module `sophie-color` in version `1.x.x` from GitHub (if the module is not already server-side cached). Same happens to `sophie-viz-color`.

After downloading, all the SCSS is compiled to CSS.

At last, we return all the CSS from `sophie-color`, but only the CSS from submodule `gender` from `sophie-viz-color`, as a string.

## Example JSON

```
GET /bundle/sophie-color@1.vars.json
```

Same process as above, however there is no SCSS-to-CSS compiling happening and also the return value is a JSON object.

# Caching

All downloaded Sophie modules are server-side cached for 7 days.

The following key is used for storing each module:

```javascript
package.name + "@" + (package.version || package.branch) + ".css"
```

The response from each route is server-side cached for 7 days as well, using the `bundleId` string as key.

This guarantees, that we don't unnecessarily download repositories from GitHub.