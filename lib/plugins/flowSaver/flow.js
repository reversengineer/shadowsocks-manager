function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const knex = appRequire('init/knex').knex;
const config = appRequire('services/config').all();
const moment = require('moment');
/*
arguments: startTime, endTime
  or
arguments: id, startTime, endTime
  or
arguments: host, port, startTime, endTime
 */
const getFlow = function () {
  if (arguments[3]) {
    const host = arguments[0];
    const port = arguments[1];
    const startTime = arguments[2];
    const endTime = arguments[3];
    return knex('saveFlow').innerJoin('server', 'server.id', 'saveFlow.id').sum('flow as sumFlow').groupBy('saveFlow.port').select(['saveFlow.port as port']).where({
      'server.host': host,
      'server.port': port
    }).whereBetween('time', [startTime, endTime]);
  } else if (arguments[2]) {
    const id = arguments[0];
    const startTime = arguments[1];
    const endTime = arguments[2];
    return knex('saveFlow').sum('flow as sumFlow').groupBy('port').select(['port']).where({ id }).whereBetween('time', [startTime, endTime]);
  } else {
    const host = config.manager.address.split(':')[0];
    const port = +config.manager.address.split(':')[1];
    const startTime = arguments[0];
    const endTime = arguments[1];
    return knex('saveFlow').innerJoin('server', 'server.id', 'saveFlow.id').sum('flow as sumFlow').groupBy('saveFlow.port').select(['saveFlow.port as port']).where({
      'server.host': host,
      'server.port': port
    }).whereBetween('time', [startTime, endTime]);
  }
};

const isDay = (start, end) => {
  let hour;
  let minute;
  let second;
  let millisecond;
  hour = moment(start).get('hour');
  minute = moment(start).get('minute');
  second = moment(start).get('second');
  millisecond = moment(start).get('millisecond');
  if (hour || minute || second || millisecond) {
    return false;
  }
  hour = moment(end).get('hour');
  minute = moment(end).get('minute');
  second = moment(end).get('second');
  millisecond = moment(end).get('millisecond');
  if (hour || minute || second || millisecond) {
    return false;
  }
  if (end >= Date.now()) {
    return false;
  }
  return true;
};

const isHour = (start, end) => {
  let minute;
  let second;
  let millisecond;
  minute = moment(start).get('minute');
  second = moment(start).get('second');
  millisecond = moment(start).get('millisecond');
  if (minute || second || millisecond) {
    return false;
  }
  minute = moment(end).get('minute');
  second = moment(end).get('second');
  millisecond = moment(end).get('millisecond');
  if (minute || second || millisecond) {
    return false;
  }
  if (end >= Date.now()) {
    return false;
  }
  return true;
};

const is5min = (start, end) => {
  let minute;
  let second;
  let millisecond;
  minute = moment(start).get('minute');
  second = moment(start).get('second');
  millisecond = moment(start).get('millisecond');
  if (minute % 5 || second || millisecond) {
    return false;
  }
  minute = moment(end).get('minute');
  second = moment(end).get('second');
  millisecond = moment(end).get('millisecond');
  if (minute % 5 || second || millisecond) {
    return false;
  }
  if (end >= Date.now()) {
    return false;
  }
  return true;
};

// const child = appFork('plugins/flowSaver/flowChildProcess');
// child.setMaxListeners(200);
const splitTime = (() => {
  var _ref = _asyncToGenerator(function* (start, end) {
    // const random = Math.random().toString().substr(2);
    // return new Promise((resolve, reject) => {
    //   child.on('message', msg => {
    //     if(msg[0] === 'splitTime' && msg[1] === random) {
    //       return resolve(msg[2]);
    //     }
    //   });
    //   child.send(['splitTime', random, start, end]);
    // });

    const time = {
      day: [],
      hour: [],
      fiveMin: [],
      origin: []
    };
    const now = Date.now();
    const getMinute = moment(now).get('minute');
    const splitEnd = {
      day: moment(now).hour(0).minute(0).second(0).millisecond(0).toDate().getTime(),
      hour: moment(now).minute(0).second(0).millisecond(0).toDate().getTime(),
      fiveMin: moment(now).minute(getMinute - getMinute % 5).second(0).millisecond(0).toDate().getTime()
    };
    const isDay = function (time) {
      const hour = moment(time).get('hour');
      const minute = moment(time).get('minute');
      const second = moment(time).get('second');
      const millisecond = moment(time).get('millisecond');
      if (hour || minute || second || millisecond) {
        return false;
      }
      return true;
    };
    const isHour = function (time) {
      const minute = moment(time).get('minute');
      const second = moment(time).get('second');
      const millisecond = moment(time).get('millisecond');
      if (minute || second || millisecond) {
        return false;
      }
      return true;
    };
    const is5min = function (time) {
      const minute = moment(time).get('minute');
      const second = moment(time).get('second');
      const millisecond = moment(time).get('millisecond');
      if (minute % 5 || second || millisecond) {
        return false;
      }
      return true;
    };
    const next = function (time, type) {
      if (type === 'day') {
        return moment(time).add(1, 'days').hour(0).minute(0).second(0).millisecond(0).toDate().getTime();
      }
      if (type === 'hour') {
        return moment(time).add(1, 'hours').minute(0).second(0).millisecond(0).toDate().getTime();
      }
      if (type === '5min') {
        const getMinute = moment(time).get('minute');
        return moment(time).minute(getMinute - getMinute % 5).add(5, 'minutes').second(0).millisecond(0).toDate().getTime();
      }
    };
    let timeStart = start;
    let timeEnd = end;
    let last;
    while (timeStart < timeEnd) {
      if (isDay(timeStart) && next(timeStart, 'day') <= splitEnd.day && next(timeStart, 'day') <= end) {
        if (last === 'day' && time.day.length) {
          const length = time.day.length;
          time.day[length - 1] = [time.day[length - 1][0], next(timeStart, 'day')];
        } else {
          time.day.push([timeStart, next(timeStart, 'day')]);
        }
        timeStart = next(timeStart, 'day');
        last = 'day';
      } else if (isHour(timeStart) && next(timeStart, 'hour') <= splitEnd.hour && next(timeStart, 'hour') <= end) {
        if (last === 'hour' && time.hour.length) {
          const length = time.hour.length;
          time.hour[length - 1] = [time.hour[length - 1][0], next(timeStart, 'hour')];
        } else {
          time.hour.push([timeStart, next(timeStart, 'hour')]);
        }
        timeStart = next(timeStart, 'hour');
        last = 'hour';
      } else if (is5min(timeStart) && next(timeStart, '5min') <= splitEnd.fiveMin && next(timeStart, '5min') <= end) {
        if (last === '5min' && time.fiveMin.length) {
          const length = time.fiveMin.length;
          time.fiveMin[length - 1] = [time.fiveMin[length - 1][0], next(timeStart, '5min')];
        } else {
          time.fiveMin.push([timeStart, next(timeStart, '5min')]);
        }
        timeStart = next(timeStart, '5min');
        last = '5min';
      } else if (next(timeStart, '5min') <= end && timeStart === start) {
        time.origin.push([timeStart, next(timeStart, '5min')]);
        timeStart = next(timeStart, '5min');
        last = '5min';
      } else {
        time.origin.push([timeStart, timeEnd]);
        timeStart = timeEnd;
        last = 'origin';
      }
    }
    return time;
  });

  return function splitTime(_x, _x2) {
    return _ref.apply(this, arguments);
  };
})();

const getFlowFromSplitTime = (() => {
  var _ref2 = _asyncToGenerator(function* (serverId, port, start, end) {
    let where = {};
    if (serverId) {
      where.id = serverId;
    }
    if (port) {
      where.port = port;
    }
    const time = yield splitTime(start, end);
    const sum = [];
    let getFlow;
    if (serverId) {
      getFlow = function (tableName, startTime, endTime) {
        return knex(tableName).sum('flow as sumFlow').groupBy('id').select(['id']).where(where).whereBetween('time', [startTime, endTime - 1]).then(function (success) {
          if (success[0]) {
            return success[0].sumFlow;
          }
          return 0;
        });
      };
    } else {
      getFlow = function (tableName, startTime, endTime) {
        return knex(tableName).sum('flow as sumFlow').groupBy('port').select(['port']).where(where).whereBetween('time', [startTime, endTime - 1]).then(function (success) {
          if (success[0]) {
            return success[0].sumFlow;
          }
          return 0;
        });
      };
    }
    time.day.forEach(function (f) {
      sum.push(getFlow('saveFlowDay', f[0], f[1]));
    });
    time.hour.forEach(function (f) {
      sum.push(getFlow('saveFlowHour', f[0], f[1]));
    });
    time.fiveMin.forEach(function (f) {
      sum.push(getFlow('saveFlow5min', f[0], f[1]));
    });
    time.origin.forEach(function (f) {
      sum.push(getFlow('saveFlow', f[0], f[1]));
    });
    const result = yield Promise.all(sum);
    const sumFlow = result.length ? result.reduce(function (a, b) {
      return a + b;
    }) : 0;
    // const random = Math.random().toString().substr(2);
    // return new Promise((resolve, reject) => {
    //   child.on('message', msg => {
    //     if(msg[0] === 'sumFlow' && msg[1] === random) {
    //       return resolve(msg[2]);
    //     }
    //   });
    //   child.send(['sumFlow', random, result]);
    // });
    return sumFlow;
  });

  return function getFlowFromSplitTime(_x3, _x4, _x5, _x6) {
    return _ref2.apply(this, arguments);
  };
})();

const getServerFlow = (() => {
  var _ref3 = _asyncToGenerator(function* (serverId, timeArray) {
    const result = [];
    timeArray.forEach(function (time, index) {
      if (index === timeArray.length - 1) {
        return;
      }
      const startTime = +time;
      const endTime = +timeArray[index + 1];
      let getFlow;
      result.push(getFlowFromSplitTime(serverId, 0, startTime, endTime));
    });
    return Promise.all(result);
  });

  return function getServerFlow(_x7, _x8) {
    return _ref3.apply(this, arguments);
  };
})();

const getServerPortFlow = (() => {
  var _ref4 = _asyncToGenerator(function* (serverId, port, timeArray, isMultiServerFlow) {
    const result = [];
    timeArray.forEach(function (time, index) {
      if (index === timeArray.length - 1) {
        return;
      }
      const startTime = +time;
      const endTime = +timeArray[index + 1];
      let getFlow;
      result.push(getFlowFromSplitTime(isMultiServerFlow ? 0 : serverId, port, startTime, endTime));
    });
    return Promise.all(result);
  });

  return function getServerPortFlow(_x9, _x10, _x11, _x12) {
    return _ref4.apply(this, arguments);
  };
})();

const getlastConnectTime = (() => {
  var _ref5 = _asyncToGenerator(function* (serverId, port) {
    const lastConnectFromSaveFlow = yield knex('saveFlow').select(['time']).where({ id: serverId, port }).orderBy('time', 'desc').limit(1).then(function (success) {
      if (success[0]) {
        return success[0].time;
      }
      return 0;
    });
    if (lastConnectFromSaveFlow) {
      return { lastConnect: lastConnectFromSaveFlow };
    }
    return knex('saveFlow5min').select(['time']).where({ id: serverId, port }).orderBy('time', 'desc').limit(1).then(function (success) {
      if (success[0]) {
        return { lastConnect: success[0].time };
      }
      return { lastConnect: 0 };
    });
  });

  return function getlastConnectTime(_x13, _x14) {
    return _ref5.apply(this, arguments);
  };
})();

const getUserPortLastConnect = (() => {
  var _ref6 = _asyncToGenerator(function* (port) {
    const lastConnectFromSaveFlow = yield knex('saveFlow').select(['time']).where({ port }).orderBy('time', 'desc').limit(1).then(function (success) {
      if (success[0]) {
        return success[0].time;
      }
      return 0;
    });
    if (lastConnectFromSaveFlow) {
      return { lastConnect: lastConnectFromSaveFlow };
    }
    return knex('saveFlow5min').select(['time']).where({ port }).orderBy('time', 'desc').limit(1).then(function (success) {
      if (success[0]) {
        return { lastConnect: success[0].time };
      }
      return { lastConnect: 0 };
    });
  });

  return function getUserPortLastConnect(_x15) {
    return _ref6.apply(this, arguments);
  };
})();

const getServerUserFlow = (serverId, timeArray) => {
  const timeStart = timeArray[0];
  const timeEnd = timeArray[1];
  let tableName = 'saveFlow5min';
  if (timeArray.length === 2) {
    if (timeEnd - timeStart === 3600 * 1000 && Date.now() - timeEnd >= 15 * 60 * 1000) {
      tableName = 'saveFlowHour';
    }
    if (timeEnd - timeStart === 24 * 3600 * 1000 && Date.now() - timeEnd >= 3600 * 1000) {
      tableName = 'saveFlowDay';
    }
    if (timeEnd - timeStart === 7 * 24 * 3600 * 1000 && Date.now() - timeEnd >= 3600 * 1000) {
      tableName = 'saveFlowDay';
    }
  }
  const where = {};
  where[tableName + '.id'] = +serverId;
  return knex(tableName).sum(`${tableName}.flow as flow`).select([`${tableName}.port`, 'user.userName']).groupBy(`${tableName}.port`).leftJoin('account_plugin', 'account_plugin.port', `${tableName}.port`).leftJoin('user', 'account_plugin.userId', 'user.id').where(where).whereBetween(`${tableName}.time`, timeArray);
};

const getAccountServerFlow = (accountId, timeArray) => {
  const timeStart = timeArray[0];
  const timeEnd = timeArray[1];
  let tableName = 'saveFlow5min';
  if (timeArray.length === 2) {
    if (timeEnd - timeStart === 3600 * 1000 && Date.now() - timeEnd >= 15 * 60 * 1000) {
      tableName = 'saveFlowHour';
    }
    if (timeEnd - timeStart === 24 * 3600 * 1000 && Date.now() - timeEnd >= 3600 * 1000) {
      tableName = 'saveFlowDay';
    }
    if (timeEnd - timeStart === 7 * 24 * 3600 * 1000 && Date.now() - timeEnd >= 3600 * 1000) {
      tableName = 'saveFlowDay';
    }
  }
  return knex(tableName).sum(`${tableName}.flow as flow`).groupBy(`${tableName}.id`).select(['server.name']).leftJoin('server', 'server.id', `${tableName}.id`).leftJoin('account_plugin', 'account_plugin.port', `${tableName}.port`).where({ 'account_plugin.id': accountId }).whereBetween(`${tableName}.time`, timeArray);
};

exports.getFlow = getFlow;
exports.getServerFlow = getServerFlow;
exports.getServerPortFlow = getServerPortFlow;
exports.getServerUserFlow = getServerUserFlow;
exports.getlastConnectTime = getlastConnectTime;
exports.getAccountServerFlow = getAccountServerFlow;
exports.getUserPortLastConnect = getUserPortLastConnect;

exports.getFlowFromSplitTime = getFlowFromSplitTime;