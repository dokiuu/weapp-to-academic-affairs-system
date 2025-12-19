const cloud = require('wx-server-sdk')
cloud.init()

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  return {
    openid: wxContext.OPENID
  }
}