const cloud = require('wx-server-sdk')
const axios = require('axios')
const cheerio = require('cheerio')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const LOGIN_URL = 'https://www.hltz.net/hlxy_jsxsd/xk/LoginToXk'
const KB_URL = 'https://www.hltz.net/hlxy_jsxsd/xskb/xskb_list.do'

const http = axios.create({
  timeout: 15000,
  maxRedirects: 5,
  httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
})

exports.main = async (event) => {
  const { stuId, pwd, userInfo } = event
  console.log('收到参数', { stuId, pwd })

  const encoded = Buffer.from(stuId).toString('base64') + '%%%' +
                  Buffer.from(pwd).toString('base64')

  try {
    // 1. 拿首页 Cookie
    const home = await http.get(LOGIN_URL)
    let cookie = ''
    if (home.headers['set-cookie']) {
      cookie = home.headers['set-cookie'].map(c => c.split(';')[0]).join('; ')
    }

    // 2. 登录
    const loginResp = await http.post(LOGIN_URL, new URLSearchParams({
      loginMethod: 'LoginToXk',
      userAccount: stuId,
      userPassword: '',
      encoded
    }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
      maxRedirects: 0,
      validateStatus: s => s < 400
    })

    if (!(loginResp.status === 302 && /xsMainV\.htmlx/.test(loginResp.headers.location || ''))) {
      console.log('登录失败', loginResp.status, loginResp.headers)
      return { code: 401, msg: '学号或密码错误', valid: false }
    }

    // 3. 合并 Cookie
    if (loginResp.headers['set-cookie']) {
      cookie = loginResp.headers['set-cookie'].map(c => c.split(';')[0]).join('; ')
    }

    // 4. 获取课表
    let kb = []
    try {
      const kbResp = await http.get(KB_URL, { headers: { Cookie: cookie } })
      const $ = cheerio.load(kbResp.data, { decodeEntities: false })

      const table = $('#timetable')
      if (table.length) {
        const periodMap = ['', '第一大节', '第二大节', '第三大节', '第四大节', '第五大节', '第六大节']
        
        table.find('tr').each((rowIdx, tr) => {
          const tds = $(tr).find('td')
          if (tds.length < 2) return
          const period = periodMap[rowIdx]
          tds.each((day, td) => {
            $(td).find('div.kbcontent').not('[style*="display:none"]').each((_, div) => {
              const cellHtml = $(div).html();
              if (!cellHtml) return;

              const dashSeparator = /(?:\<br\>)*\-{10,}(?:\<br\>)*/;
              let courseBlocks = cellHtml.split(dashSeparator);

              if (courseBlocks.length <= 1) {
                courseBlocks = [cellHtml];
              }

              courseBlocks.forEach((blockHtml, blockIndex) => {
                const cleanBlockHtml = blockHtml.trim().replace(/(^<br>|<br>$)/gi, '');
                if (!cleanBlockHtml) return;

                const $block = cheerio.load('<div>' + cleanBlockHtml + '</div>', { decodeEntities: false });
                
                let course = '';
                let teacher = '';
                let weeks = '';
                let room = '';

                $block('font').each((i, el) => {
                  const $el = $block(el);
                  if (!course && !$el.attr('title')) {
                    course = $el.text().trim();
                    return false;
                  }
                });

                $block('font[title="教师"]').each((i, el) => {
                  teacher = $block(el).text().trim();
                  return false;
                });

                $block('font[title="周次(节次)"]').each((i, el) => {
                  weeks = $block(el).text().trim();
                  return false;
                });

                $block('font[title="教室"]').each((i, el) => {
                  room = $block(el).text().trim();
                  return false;
                });

                if (course && weeks && room && teacher) {
                  kb.push({
                    day: day,
                    time: period,
                    course: course,
                    weeks: weeks,
                    room: room,
                    teacher: teacher
                  });
                }
              });
            });
          });
        });
      }
    } catch (error) {
      console.error('获取课表失败，但登录成功:', error)
      // 即使课表获取失败，只要登录成功就继续
    }

    console.log('解析到课程数：', kb.length);
    
    // 5. 保存或更新用户信息到数据库（无论是否获取到课表）
    await saveUserInfo(stuId, userInfo)
    
    if (kb.length === 0) {
      return { code: 404, msg: '未找到课表', valid: true, data: [] }
    }
    
    return { code: 0, data: kb, valid: true }

  } catch (error) {
    console.error('云函数执行错误:', error)
    return { code: 500, msg: '服务器错误', valid: false }
  }
}

// 保存用户信息到数据库的辅助函数
async function saveUserInfo(stuId, userInfo) {
  try {
    const db = cloud.database()
    const usersCollection = db.collection('users')
    
    // 检查用户是否已存在
    const userExist = await usersCollection.where({
      stuId: stuId
    }).get()
    
    const now = new Date()
    
    if (userExist.data.length > 0) {
      // 更新用户信息 - 只更新传入的信息，保留原有信息
      const updateData = {
        lastLoginTime: now,
        updateTime: now
      }
      
      if (userInfo && userInfo.nickName) {
        updateData.nickName = userInfo.nickName
      }
      if (userInfo && userInfo.avatarUrl) {
        updateData.avatarUrl = userInfo.avatarUrl
      }
      
      await usersCollection.doc(userExist.data[0]._id).update({
        data: updateData
      })
      console.log('用户信息更新成功:', stuId)
    } else {
      // 创建新用户
      await usersCollection.add({
        data: {
          stuId: stuId,
          nickName: (userInfo && userInfo.nickName) || `用户${stuId}`,
          avatarUrl: (userInfo && userInfo.avatarUrl) || '',
          createTime: now,
          lastLoginTime: now,
          updateTime: now
        }
      })
      console.log('新用户创建成功:', stuId)
    }
  } catch (error) {
    console.error('保存用户信息失败:', error)
    // 不因为用户信息保存失败而影响课表获取
  }
}