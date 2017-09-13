function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const knex = appRequire('init/knex').knex;
const serverPlugin = appRequire('plugins/flowSaver/server');
const accountPlugin = appRequire('plugins/account/index');
const dns = require('dns');
const net = require('net');

const getIp = address => {
  if (net.isIP(address)) {
    return Promise.resolve(address);
  }
  return new Promise((resolve, reject) => {
    dns.lookup(address, (err, address, family) => {
      if (err) {
        return reject(err);
      }
      return resolve(address);
    });
  });
};

const newAccount = (mac, userId, serverId, accountId) => {
  return knex('mac_account').insert({
    mac, userId, serverId, accountId
  });
};

const getAccount = (() => {
  var _ref = _asyncToGenerator(function* (userId) {
    const accounts = yield knex('mac_account').where({
      'mac_account.userId': userId
    });
    return accounts;
  });

  return function getAccount(_x) {
    return _ref.apply(this, arguments);
  };
})();

const getAccountForUser = (() => {
  var _ref2 = _asyncToGenerator(function* (mac, serverId, accountId) {
    const macAccount = yield knex('mac_account').where({ mac }).then(function (success) {
      return success[0];
    });
    const myServerId = serverId || macAccount.serverId;
    const myAccountId = accountId || macAccount.accountId;
    const accounts = yield knex('mac_account').select(['mac_account.id', 'mac_account.mac', 'account_plugin.id as accountId', 'account_plugin.port', 'account_plugin.password']).leftJoin('user', 'mac_account.userId', 'user.id').leftJoin('account_plugin', 'mac_account.userId', 'account_plugin.userId');
    const account = accounts.filter(function (a) {
      return a.accountId === myAccountId;
    })[0];
    const servers = yield serverPlugin.list();
    const server = servers.filter(function (s) {
      return s.id === myServerId;
    })[0];
    const address = yield getIp(server.host);
    const validServers = JSON.parse((yield accountPlugin.getAccount({ id: myAccountId }))[0].server);
    const serverList = servers.filter(function (f) {
      if (!validServers) {
        return true;
      } else {
        return validServers.indexOf(f.id) >= 0;
      }
    }).map(function (f) {
      return getIp(f.host).then(function (success) {
        return {
          name: f.name,
          address: success
        };
      });
    });
    const serverReturn = yield Promise.all(serverList);
    return {
      default: {
        address,
        port: account.port,
        password: account.password,
        method: server.method
      },
      servers: serverReturn
    };
  });

  return function getAccountForUser(_x2, _x3, _x4) {
    return _ref2.apply(this, arguments);
  };
})();

const editAccount = (id, mac, serverId, accountId) => {
  return knex('mac_account').update({
    mac, serverId, accountId
  }).where({ id });
};

const deleteAccount = id => {
  return knex('mac_account').delete().where({ id });
};

exports.editAccount = editAccount;
exports.newAccount = newAccount;
exports.getAccount = getAccount;
exports.deleteAccount = deleteAccount;
exports.getAccountForUser = getAccountForUser;