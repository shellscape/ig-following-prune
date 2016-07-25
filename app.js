/*
 A simple node script to fetch instagram followers and determine who hasn't
 posted in eons, so they can be unfollowed. Very, very basic pruning.

 Usage: npm install && node app --token=<ig access token>
*/

var _ = require('underscore'),
  fs = require('fs'),
  path = require('path'),
  moment = require('moment'),
  request = require('request'),
  argv = require('yargs').argv,
  following = [],
  usersLast = [],
  inactives = {
    one: [],
    three: [],
    six: []
  },
  startUrl = 'https://api.instagram.com/v1/users/self/follows?access_token=' + argv.token  + '&count=100',
  done = false;

function getFollowing (url) {
  request(url, function (err, result) {
    var page = JSON.parse(result.body);
    following = following.concat(page.data);

    if (page.pagination.next_url) {
      getFollowing(page.pagination.next_url);
    }
    else {
      fs.writeFileSync(path.join(__dirname, 'following.json'), JSON.stringify({ following: following }, null, 2), 'utf-8');
    }
  });
}

function getLast (userId, isLast) {
  var url = 'https://api.instagram.com/v1/users/' + userId + '/media/recent/?access_token=' + argv.token  + '&count=1'

  request(url, function (err, result) {

    console.log(url);

    if (err) {
      console.log(err);
      return;
    }

    try {
      var page = JSON.parse(result.body),
        data;

      if (page.data.length === 0) {
        return;
      }

      data = page.data[0];

      usersLast.push({ id: userId, name: data.user.username, last: data.created_time });

      if (isLast) {
        done = true;
      }
    }
    catch (e) {
      console.log(result);
      throw e;
    }
  });
}

// step 1 - get my followers
getFollowing(startUrl);

// step 2 - list the last post times for all followers
following = require('./following.json').following;

following.forEach(function (user) {
  getLast(user.id, following[following.length - 1].id === user.id);
});

var interval = setInterval(function () {
  if (done) {
    clearInterval(interval);
    fs.writeFileSync(path.join(__dirname, 'usersLast.json'), JSON.stringify({ usersLast: usersLast }, null, 2), 'utf-8');
  }
}, 100);

// step 3 - create a list of followers that haven't posted since X
usersLast = require('./usersLast.json').usersLast;

var lastMonth = moment().subtract(1, 'month'),
  last3Months = moment().subtract(3, 'months'),
  last6Months = moment().subtract(6, 'months');

usersLast.forEach(function (user) {
  var date = moment.unix(user.last);

  if (date.isBefore(last6Months)) {
    inactives.six.push(user);
  }
  else if (date.isBefore(last3Months)) {
    inactives.three.push(user);
  }
  else if (date.isBefore(lastMonth)) {
    inactives.one.push(user);
  }
});

fs.writeFileSync(path.join(__dirname, 'inactives-one.json'), JSON.stringify({ inactives: inactives.one }, null, 2), 'utf-8');
fs.writeFileSync(path.join(__dirname, 'inactives-three.json'), JSON.stringify({ inactives: inactives.three }, null, 2), 'utf-8');
fs.writeFileSync(path.join(__dirname, 'inactives-six.json'), JSON.stringify({ inactives: inactives.six }, null, 2), 'utf-8');

// setp 4 - manual inspection
inactives.one = require('./inactives-one.json').inactives;

var spawn = require('child_process').spawn,
  timeout = 0;

inactives.one.forEach(function (user) {
  setTimeout(function () {
    console.log(user.name, timeout)
    spawn('open', ['https://instagram.com/' + user.name]);
  }, timeout);
  timeout += 500;
});
