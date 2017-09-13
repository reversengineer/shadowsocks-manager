function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const log4js = require('log4js');
const logger = log4js.getLogger('account');
const knex = appRequire('init/knex').knex;
const serverManager = appRequire('plugins/flowSaver/server');
const flow = appRequire('plugins/flowSaver/flow');
const manager = appRequire('services/manager');
const moment = require('moment');
const cron = appRequire('init/cron');
let messages = [];

const sendMessage = () => {
  if (!messages.length) {
    return;
  }
  messages.forEach(message => {
    manager.send(message[0], message[1]).then().catch();
  });
  messages = [];
};

cron.second(() => {
  sendMessage();
}, 10);

const addPort = (data, server) => {
  messages.push([{
    command: 'add',
    port: data.port,
    password: data.password
  }, {
    host: server.host,
    port: server.port,
    password: server.password
  }]);
};

const delPort = (data, server) => {
  messages.push([{
    command: 'del',
    port: data.port
  }, {
    host: server.host,
    port: server.port,
    password: server.password
  }]);
};

const changePassword = (() => {
  var _ref = _asyncToGenerator(function* (id, password) {
    const server = yield serverManager.list();
    const account = yield knex('account_plugin').select();
    const port = account.filter(function (f) {
      return f.id === id;
    })[0].port;
    if (!port) {
      return Promise.reject('account id not exists');
    }
    server.forEach(function (s) {
      messages.push([{
        command: 'pwd',
        port,
        password
      }, {
        host: s.host,
        port: s.port,
        password: s.password
      }]);
    });
    return;
  });

  return function changePassword(_x, _x2) {
    return _ref.apply(this, arguments);
  };
})();

const checkFlow = (() => {
  var _ref2 = _asyncToGenerator(function* (server, port, startTime, endTime) {
    let isMultiServerFlow = false;
    try {
      isMultiServerFlow = yield knex('webguiSetting').select().where({ key: 'account' }).then(function (success) {
        if (!success.length) {
          return Promise.reject('settings not found');
        }
        success[0].value = JSON.parse(success[0].value);
        return success[0].value.multiServerFlow;
      });
    } catch (err) {}
    const serverId = isMultiServerFlow ? null : server;
    const userFlow = yield flow.getFlowFromSplitTime(serverId, port, startTime, endTime);
    return userFlow;
  });

  return function checkFlow(_x3, _x4, _x5, _x6) {
    return _ref2.apply(this, arguments);
  };
})();

const checkAccountTime = {};

const deleteCheckAccountTimePort = port => {
  const reg = new RegExp('^\d{1,3}\|' + port + '$');
  for (cat in checkAccountTime) {
    if (cat.match(reg)) {
      delete checkAccountTime[cat];
    }
  }
};
const deleteCheckAccountTimeServer = Server => {
  const reg = new RegExp('^' + Server + '\|\d{1,5}$');
  for (cat in checkAccountTime) {
    if (cat.match(reg)) {
      delete checkAccountTime[cat];
    }
  }
};

let lastCheck = 0;
const checkServer = (() => {
  var _ref3 = _asyncToGenerator(function* () {
    if (!lastCheck) {
      lastCheck = Date.now();
    } else if (Date.now() - lastCheck <= 29 * 1000) {
      return;
    }
    lastCheck = Date.now();
    logger.info('check account');
    const account = yield knex('account_plugin').select();
    account.forEach(function (a) {
      if (a.type >= 2 && a.type <= 5) {
        let timePeriod = 0;
        if (a.type === 2) {
          timePeriod = 7 * 86400 * 1000;
        }
        if (a.type === 3) {
          timePeriod = 30 * 86400 * 1000;
        }
        if (a.type === 4) {
          timePeriod = 1 * 86400 * 1000;
        }
        if (a.type === 5) {
          timePeriod = 3600 * 1000;
        }
        const data = JSON.parse(a.data);
        let startTime = data.create;
        while (startTime + timePeriod <= Date.now()) {
          startTime += timePeriod;
        }
        if (data.create + data.limit * timePeriod <= Date.now() || data.create >= Date.now()) {
          if (a.autoRemove) {
            knex('account_plugin').delete().where({ id: a.id }).then();
          }
        }
      }
    });
    const server = yield serverManager.list();
    account.exist = function (number) {
      return !!account.filter(function (f) {
        return f.port === number;
      })[0];
    };
    let isMultiServerFlow = false;
    try {
      isMultiServerFlow = yield knex('webguiSetting').select().where({ key: 'account' }).then(function (success) {
        if (!success.length) {
          return Promise.reject('settings not found');
        }
        success[0].value = JSON.parse(success[0].value);
        return success[0].value.multiServerFlow;
      });
    } catch (err) {}
    const promises = [];
    server.forEach(function (s) {
      const checkServerAccount = (() => {
        var _ref4 = _asyncToGenerator(function* (s) {
          try {
            const port = yield manager.send({ command: 'list' }, {
              host: s.host,
              port: s.port,
              password: s.password
            });
            port.list = {};
            port.forEach(function (f) {
              port.list[f.port] = true;
            });
            port.exist = function (number) {
              return !!port.list[number];
            };
            const checkAccountStatus = (() => {
              var _ref5 = _asyncToGenerator(function* (a) {
                const accountServer = a.server ? JSON.parse(a.server) : a.server;
                if (accountServer) {
                  const newAccountServer = accountServer.filter(function (f) {
                    return server.filter(function (sf) {
                      return sf.id === f;
                    })[0];
                  });
                  if (JSON.stringify(newAccountServer) !== JSON.stringify(accountServer)) {
                    yield knex('account_plugin').update({
                      server: JSON.stringify(newAccountServer)
                    }).where({
                      port: a.port
                    });
                  }
                }
                if (accountServer && accountServer.indexOf(s.id) < 0) {
                  port.exist(a.port) && delPort(a, s);
                  return 0;
                }
                if (a.type >= 2 && a.type <= 5) {
                  let timePeriod = 0;
                  if (a.type === 2) {
                    timePeriod = 7 * 86400 * 1000;
                  }
                  if (a.type === 3) {
                    timePeriod = 30 * 86400 * 1000;
                  }
                  if (a.type === 4) {
                    timePeriod = 1 * 86400 * 1000;
                  }
                  if (a.type === 5) {
                    timePeriod = 3600 * 1000;
                  }
                  const data = JSON.parse(a.data);
                  let startTime = data.create;
                  while (startTime + timePeriod <= Date.now()) {
                    startTime += timePeriod;
                  }
                  let flow = -1;
                  if (!checkAccountTime['' + s.id + '|' + a.port] || checkAccountTime['' + s.id + '|' + a.port] && Date.now() >= checkAccountTime['' + s.id + '|' + a.port]) {
                    flow = yield checkFlow(s.id, a.port, startTime, Date.now());
                    const nextTime = (data.flow * (isMultiServerFlow ? 1 : s.scale) - flow) / 200000000 * 60 * 1000;
                    if (nextTime <= 0) {
                      checkAccountTime['' + s.id + '|' + a.port] = Date.now() + 10 * 60 * 1000;
                    } else {
                      checkAccountTime['' + s.id + '|' + a.port] = Date.now() + nextTime;
                    }
                  }
                  if (flow >= 0 && isMultiServerFlow && flow >= data.flow) {
                    port.exist(a.port) && delPort(a, s);
                    return 1;
                  } else if (flow >= 0 && !isMultiServerFlow && flow >= data.flow * s.scale) {
                    port.exist(a.port) && delPort(a, s);
                    return 1;
                  } else if (data.create + data.limit * timePeriod <= Date.now() || data.create >= Date.now()) {
                    port.exist(a.port) && delPort(a, s);
                    return 0;
                  } else if (!port.exist(a.port) && flow >= 0) {
                    addPort(a, s);
                    return 0;
                  } else {
                    return flow >= 0 ? 1 : 0;
                  }
                } else if (a.type === 1) {
                  if (port.exist(a.port)) {
                    return 0;
                  }
                  addPort(a, s);
                  return 0;
                } else {
                  return 0;
                }
              });

              return function checkAccountStatus(_x8) {
                return _ref5.apply(this, arguments);
              };
            })();
            const checkAccountStatusPromises = [];
            account.forEach(function (a) {
              checkAccountStatusPromises.push(checkAccountStatus(a));
            });
            const checkFlowNumber = yield Promise.all(checkAccountStatusPromises).then(function (success) {
              if (!success.length) {
                return 0;
              }
              const checkFlowNumber = success.reduce(function (a, b) {
                return a + b;
              });
              logger.info(`check account flow [${s.name}] ${checkFlowNumber}`);
              return checkFlowNumber;
            });
            port.forEach((() => {
              var _ref6 = _asyncToGenerator(function* (p) {
                if (!account.exist(p.port)) {
                  delPort(p, s);
                }
              });

              return function (_x9) {
                return _ref6.apply(this, arguments);
              };
            })());
            return checkFlowNumber;
          } catch (err) {
            logger.error(err);
            return 0;
          }
        });

        return function checkServerAccount(_x7) {
          return _ref4.apply(this, arguments);
        };
      })();
      promises.push(checkServerAccount(s));
    });
    Promise.all(promises).then(function (success) {
      const sum = success.reduce(function (a, b) {
        return a + b;
      });
      if (sum <= 40) {
        let deleteCount = 40 - sum;
        Object.keys(checkAccountTime).filter(function (f, i, arr) {
          return Math.random() <= deleteCount / arr.length / 2 ? f : null;
        }).forEach(function (f) {
          delete checkAccountTime[f];
        });
      }
    });
  });

  return function checkServer() {
    return _ref3.apply(this, arguments);
  };
})();

exports.checkServer = checkServer;
exports.sendMessage = sendMessage;
exports.addPort = addPort;
exports.delPort = delPort;
exports.changePassword = changePassword;
exports.deleteCheckAccountTimePort = deleteCheckAccountTimePort;
exports.deleteCheckAccountTimeServer = deleteCheckAccountTimeServer;

setTimeout(() => {
  checkServer();
}, 8 * 1000);
cron.minute(() => {
  checkServer();
}, 2);