function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const log4js = require('log4js');
const logger = log4js.getLogger('paypal');
const knex = appRequire('init/knex').knex;
const cron = appRequire('init/cron');
const paypal = require('paypal-rest-sdk');
const account = appRequire('plugins/account/index');
const moment = require('moment');
const push = appRequire('plugins/webgui/server/push');
const config = appRequire('services/config').all();

if (config.plugins.paypal && config.plugins.paypal.use) {
  paypal.configure({
    mode: config.plugins.paypal.mode,
    client_id: config.plugins.paypal.client_id,
    client_secret: config.plugins.paypal.client_secret
  });
}

const createOrder = (() => {
  var _ref = _asyncToGenerator(function* (user, account, amount, type) {
    try {
      const orderSetting = yield knex('webguiSetting').select().where({
        key: 'payment'
      }).then(function (success) {
        if (!success.length) {
          return Promise.reject('settings not found');
        }
        success[0].value = JSON.parse(success[0].value);
        return success[0].value;
      }).then(function (success) {
        if (type === 5) {
          return success.hour;
        } else if (type === 4) {
          return success.day;
        } else if (type === 2) {
          return success.week;
        } else if (type === 3) {
          return success.month;
        } else if (type === 6) {
          return success.season;
        } else if (type === 7) {
          return success.year;
        }
      });
      const create_payment_json = {
        intent: 'sale',
        payer: {
          payment_method: 'paypal'
        },
        redirect_urls: {
          return_url: config.plugins.webgui.site + '/user/account',
          cancel_url: config.plugins.webgui.site + '/user/account'
        },
        transactions: [{
          amount: {
            currency: 'USD',
            total: amount
          },
          description: orderSetting.orderName || 'ss'
        }]
      };
      const payment = yield new Promise(function (resolve, reject) {
        paypal.payment.create(JSON.stringify(create_payment_json), function (error, payment) {
          if (error) {
            console.log(error);
            reject(error);
          } else {
            resolve(payment);
          }
        });
      });
      const orderId = moment().format('YYYYMMDDHHmmss') + Math.random().toString().substr(2, 6);
      yield knex('paypal').insert({
        orderId,
        paypalId: payment.id,
        orderType: type,
        amount: amount + '',
        user,
        account: account !== 'undefined' && account ? account : null,
        status: 'created',
        createTime: Date.now(),
        expireTime: Date.now() + 2 * 60 * 60 * 1000
      });
      return { paymentID: payment.id };
    } catch (err) {
      console.log(err);
      return Promise.reject(err);
    }
  });

  return function createOrder(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  };
})();

const executeOrder = (() => {
  var _ref2 = _asyncToGenerator(function* (order) {
    const orderInfo = yield new Promise(function (resolve, reject) {
      paypal.payment.get(order.paymentID, function (error, payment) {
        if (error) {
          console.log(error);
          reject(error);
        } else {
          resolve(payment);
        }
      });
    });
    const execute_payment_json = {
      payer_id: orderInfo.payer.payer_info.payer_id,
      transactions: [{
        amount: orderInfo.transactions[0].amount
      }]
    };
    return new Promise(function (resolve, reject) {
      paypal.payment.execute(order.paymentID, JSON.stringify(execute_payment_json), function (error, payment) {
        if (error) {
          console.log(error);
          return reject(error);
        } else {
          return resolve();
        }
      });
    });
  });

  return function executeOrder(_x5) {
    return _ref2.apply(this, arguments);
  };
})();

exports.createOrder = createOrder;
exports.executeOrder = executeOrder;

const checkOrder = (() => {
  var _ref3 = _asyncToGenerator(function* (paypalId) {
    const orderInfo = yield new Promise(function (resolve, reject) {
      paypal.payment.get(paypalId, function (error, payment) {
        if (error) {
          console.log(error);
          reject(error);
        } else {
          resolve(payment);
        }
      });
    });
    yield knex('paypal').update({ status: orderInfo.state, paypalData: JSON.stringify(orderInfo) }).where({ paypalId });
    return;
  });

  return function checkOrder(_x6) {
    return _ref3.apply(this, arguments);
  };
})();

const sendSuccessMail = (() => {
  var _ref4 = _asyncToGenerator(function* (userId) {
    const emailPlugin = appRequire('plugins/email/index');
    const user = yield knex('user').select().where({
      type: 'normal',
      id: userId
    }).then(function (success) {
      if (success.length) {
        return success[0];
      }
      return Promise.reject('user not found');
    });
    const orderMail = yield knex('webguiSetting').select().where({
      key: 'mail'
    }).then(function (success) {
      if (!success.length) {
        return Promise.reject('settings not found');
      }
      success[0].value = JSON.parse(success[0].value);
      return success[0].value.order;
    });
    yield emailPlugin.sendMail(user.email, orderMail.title, orderMail.content);
  });

  return function sendSuccessMail(_x7) {
    return _ref4.apply(this, arguments);
  };
})();

cron.minute(_asyncToGenerator(function* () {
  if (!config.plugins.paypal || !config.plugins.paypal.use) {
    return;
  }
  const orders = yield knex('paypal').select().whereNotBetween('expireTime', [0, Date.now()]);
  const scanOrder = function (order) {
    if (order.status !== 'approved' && order.status !== 'finish') {
      return checkOrder(order.paypalId);
    } else if (order.status === 'approved') {
      const accountId = order.account;
      const userId = order.user;
      push.pushMessage('支付成功', {
        body: `订单[ ${order.orderId} ][ ${order.amount} ]支付成功`
      });
      return checkOrder(order.paypalId).then(function () {
        return account.setAccountLimit(userId, accountId, order.orderType);
      }).then(function () {
        return knex('paypal').update({
          status: 'finish'
        }).where({
          orderId: order.orderId
        });
      }).then(function () {
        logger.info(`订单支付成功: [${order.orderId}][${order.amount}][account: ${accountId}]`);
        sendSuccessMail(userId);
      }).catch(function (err) {
        logger.error(`订单支付失败: [${order.orderId}]`, err);
      });
    };
  };
  for (const order of orders) {
    yield scanOrder(order);
  }
}), 1);

const orderList = (() => {
  var _ref6 = _asyncToGenerator(function* (options = {}) {
    const where = {};
    if (options.userId) {
      where['user.id'] = options.userId;
    }
    const orders = yield knex('paypal').select(['paypal.orderId', 'paypal.orderType', 'user.id as userId', 'user.username', 'account_plugin.port', 'paypal.amount', 'paypal.status', 'paypal.paypalData', 'paypal.createTime', 'paypal.expireTime']).leftJoin('user', 'user.id', 'paypal.user').leftJoin('account_plugin', 'account_plugin.id', 'paypal.account').where(where).orderBy('paypal.createTime', 'DESC');
    orders.forEach(function (f) {
      f.paypalData = JSON.parse(f.paypalData);
    });
    return orders;
  });

  return function orderList() {
    return _ref6.apply(this, arguments);
  };
})();

const orderListAndPaging = (() => {
  var _ref7 = _asyncToGenerator(function* (options = {}) {
    const search = options.search || '';
    const filter = options.filter || [];
    const sort = options.sort || 'paypal.createTime_desc';
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;

    let count = knex('paypal').select();
    let orders = knex('paypal').select(['paypal.orderId', 'paypal.orderType', 'user.id as userId', 'user.username', 'account_plugin.port', 'paypal.amount', 'paypal.status', 'paypal.paypalData', 'paypal.createTime', 'paypal.expireTime']).leftJoin('user', 'user.id', 'paypal.user').leftJoin('account_plugin', 'account_plugin.id', 'paypal.account');

    if (filter.length) {
      count = count.whereIn('paypal.status', filter);
      orders = orders.whereIn('paypal.status', filter);
    }
    if (search) {
      count = count.where('paypal.orderId', 'like', `%${search}%`);
      orders = orders.where('paypal.orderId', 'like', `%${search}%`);
    }

    count = yield count.count('orderId as count').then(function (success) {
      return success[0].count;
    });
    orders = yield orders.orderBy(sort.split('_')[0], sort.split('_')[1]).limit(pageSize).offset((page - 1) * pageSize);
    orders.forEach(function (f) {
      f.paypalData = JSON.parse(f.paypalData);
    });
    const maxPage = Math.ceil(count / pageSize);
    return {
      total: count,
      page,
      maxPage,
      pageSize,
      orders
    };
  });

  return function orderListAndPaging() {
    return _ref7.apply(this, arguments);
  };
})();

exports.orderListAndPaging = orderListAndPaging;
exports.orderList = orderList;

cron.minute(() => {
  if (!config.plugins.paypal || !config.plugins.paypal.use) {
    return;
  }
  knex('paypal').delete().where({ status: 'created' }).whereBetween('expireTime', [0, Date.now() - 1 * 24 * 3600 * 1000]).then();
}, 30);