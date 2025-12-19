// const cloud = require('wx-server-sdk')
// cloud.init()

// exports.main = async (event) => {
//   try {
//     const db = cloud.database()
//     const { category } = event
    
//     // 构建查询条件
//     let query = db.collection('clubs').where({
//       isActive: true
//     })
    
//     // 如果有分类参数，添加分类筛选
//     if (category && category !== 'all') {
//       query = query.where({
//         category: category
//       })
//     }
    
//     // 获取社团数据
//     const res = await query
//       .orderBy('createTime', 'desc')
//       .get()
    
//     return {
//       code: 200,
//       data: res.data,
//       message: '获取成功'
//     }
//   } catch (error) {
//     console.error('获取社团数据失败:', error)
//     return {
//       code: 500,
//       data: [],
//       message: '获取失败'
//     }
//   }
// }