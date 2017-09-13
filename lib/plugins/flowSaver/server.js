function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const knex = appRequire('init/knex').knex;
const manager = appRequire('services/manager');
const checkAccount = appRequire('plugins/account/checkAccount');

const add = (name, host, port, password, method) => {
  return knex('server').insert({
    name,
    host,
    port,
    password,
    method
  });
};

const del = id => {
  return knex.transaction(trx => {
    return knex('server').transacting(trx).where({ id }).delete().then(() => {
      return knex('saveFlow').transacting(trx).where({ id }).delete();
    }).then(trx.commit).catch(trx.rollback);
  });
};

const edit = (id, name, host, port, password, method, scale = 1, comment = '') => {
  checkAccount.deleteCheckAccountTimeServer(id);
  return knex('server').where({ id }).update({
    name,
    comment,
    host,
    port,
    password,
    method,
    scale
  });
};

const list = (() => {
  var _ref = _asyncToGenerator(function* (options = {}) {
    const serverList = yield knex('server').select(['id', 'name', 'host', 'port', 'password', 'method', 'scale', 'comment']).orderBy('name');
    if (options.status) {
      const serverStatus = [];
      const getServerStatus = function (server, index) {
        return manager.send({
          command: 'version'
        }, {
          host: server.host,
          port: server.port,
          password: server.password
        }).then(function (success) {
          return { status: success.version, index };
        }).catch(function (error) {
          return { status: -1, index };
        });
      };
      serverList.forEach(function (server, index) {
        serverStatus.push(getServerStatus(server, index));
      });
      const status = yield Promise.all(serverStatus);
      status.forEach(function (f) {
        serverList[f.index].status = f.status;
      });
    }
    return serverList;
  });

  return function list() {
    return _ref.apply(this, arguments);
  };
})();

exports.add = add;
exports.del = del;
exports.edit = edit;
exports.list = list;