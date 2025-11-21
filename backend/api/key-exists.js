import {getUserKey} from '../functions'

export  default  async function handler (request,res){
  
  const {userId} = request.body

  const keystatus = await getUserKey(userId)
  res.json(keystatus)

  if(keystatus.exists && keystatus.res.length>0){
    res.json(keystatus)
  }else{
    res.json(keystatus)
  }

}

