import express, {json} from "express";
import cors from "cors";
import chalk from "chalk";
import dotenv from "dotenv";
import dayjs from "dayjs";
import joi from "joi";
import { MongoClient, ObjectId } from "mongodb";
import { stripHtml } from "string-strip-html";
//import jwt from "jwt-simple";

const app = express();

app.use(cors());
app.use(json());
dotenv.config();

const PORT = process.env.PORTA;
const NOME = process.env.NOMEE;
let db = null;

const mongoClient = new MongoClient(process.env.MONGO_URI);
const promise = mongoClient.connect();

promise.then(() => 
  db = mongoClient.db('UOL__DB')
);
promise.catch(err =>
  console.log("Não foi possível se conectar", err)
);

app.post('/participants', async (req, res) => {
  const{ name } = req.body;

  const Schema = joi.object().keys({ name: joi.string().min(1).required(),});

  const result = joi.validate(name, Schema); 
  const { error } = result; 
  const valid = error == null; 

  if(!valid){
    res.status(422).send.chalk.red.bold(
      'Todos os campos são obrigatórios!'
      ); 
    return
  };

  if(db.collection("participantes").filter((e) => e.name === name)){
    res.status(409).send.chalk.red.bold(
      'Nome já está sendo utilizado'
      ); 
    return
  }
    try {
      const newUser = await db.collection("participantes").insertOne(
        {name: name, lastStatus: Date.now()}
      );
      const signMsg = await db.collection("mensagems").insertOne(
        {from: name, to: 'Todos', text: `${name} entra na sala...`, type: 'status', time: dayjs(Date.now()).format("HH:mm:ss")}
      );
      res.status(201).send.chalk.green.bold(`Criado com sucesso: ${newUser.name} as ${signMsg.time}`);
      return
    }
    catch (error) {
      console.error(err);
      res.sendStatus(500);
      return
    };
  }
);
app.get('/participants', async (req, res) => {
    await db.collection("participantes").find().toArray().then(users => {
    res.status(200).send.chalk.green.bold(
      users
      ); 
    return
	});
});
app.post('/messages', async (req, res) => {
  const{ to, text, type} = req.body;
  const { User } = req.headers;
  const Mensagem = { User, to ,text, type };

  if(!User){
    res.status(404).send.chalk.red.bold(
      'Usuario Inexistente ou Usuario não Preenchido!'
      ); 
    return
  };

  if(!to || !text || !type ){
    res.status(400).send.chalk.red.bold(
      'Todos os campos são obrigatórios!'
      ); 
    return
  };

  const Schema = joi.object().keys({ 
    to: joi.string().min(1).trim().required(),
    text: joi.string().min(1).trim().required(),
    type: joi.string().trim().required() && type === 'message' || type === 'private_message',
    from: await db.collection("participantes").filter((e) => e.name === User),
  });

  const result = joi.validate(Mensagem, Schema); 
  const { error } = result; 
  const valid = error == null; 

  if(!valid){
    res.status(422).send.chalk.red.bold(
      'Todos os campos são obrigatórios!'
      ); 
    return
  };

  try {
    const newMsg = await db.collection("mensagems").insertOne(
      {from: User , to, text, type, time: dayjs.format("HH:mm:ss")}
    );
    res.status(201).send.chalk.green.bold(`Mensagem enviada sucesso ${newMsg.from}`);
    return
  }
  catch (error) {
    console.error(err);
    res.sendStatus(500);
    return
  };
});
app.post('/status', async (req, res) => {
  const { User } = req.headers;
  if(!User && await db.collection("participantes").filter((e) => e.name === !User)){
    res.status(404).send.chalk.red.bold(
      'Usuario Inexistente!'
      ); 
    return
  };
  
  if( await db.collection("participantes").filter((e) => e.name === User)){
    try {
      const newUser = await db.collection("participantes").insertOne(
        {name: User, lastStatus: Date.now()}
      );
      res.status(200).send.chalk.green.bold(`Status Alterado com Sucesso: ${newUser.name}`);
      return
    }
    catch (error) {
      console.error(err);
      res.sendStatus(500);
      return
    };}
});
app.get('/messages', async (req, res) => {
  const { limit } = req.query;
  const { User } = req.headers;
  try{
    const dbTo = await db.collection("messages").find({to: User}).toArray();
    const dbFrom = await db.collection("messages").find({from: User}).toArray();
    const dbPublica = await db.collection("messages").find({to: "Todos"}).toArray();
    const Messages = [...new Set([...dbTo ,...dbFrom ,...dbPublica])];

    if(isNaN(limit)){
        return res.status(201).send(Messages);
    }
    res.status(201).send(Messages.splice(-limit));
    }catch(e){
    res.status(422).send.chalk.red.bold({errorMessage: `Error: ${e.message}`});
  }
});
app.put('/messages/:ID_DA_MENSAGEM', async (req, res) => {
  const { User } = req.headers;
  const { ID_DA_MENSAGEM } = req.params;
  const{ to, text, type} = req.body;

  if(!User){
    res.status(404).send.chalk.red.bold(
      'Usuario Inexistente ou Usuario não Preenchido!'
      ); 
    return
  };

  if(!to || !text || !type ){
    res.status(400).send.chalk.red.bold(
      'Todos os campos são obrigatórios!'
      ); 
    return
  };

  const Schema = joi.object().keys({ 
    to: joi.string().min(1).trim().required(),
    text: joi.string().min(1).trim().required(),
    type: joi.string().trim().required() && type === 'message' || type === 'private_message',
    from: await db.collection("participantes").filter((e) => e.name === User),
  });

  const result = joi.validate(Mensagem, Schema); 
  const { error } = result; 
  const valid = error == null; 

  if(!valid){
    res.status(422).send.chalk.red.bold(
      'Todos os campos são obrigatórios!'
      ); 
    return
  };
  try {
    const message = await db.collection('messages').findOne({_id: new ObjectId(ID_DA_MENSAGEM)});
    
    if(!message){
      return res.sendStatus(404);
    }
    if(message.from !== User){
      return res.sendStatus(401);
    }

    await db.collection('messages').deleteOne({_id: new ObjectId(ID_DA_MENSAGEM)});
    res.sendStatus(200);
} catch(e){
    res.status(500).send({errorMessage: `Não foi possível deletar a mensagem! Causa: ${e}`});
}
});
app.delete('/messages/:ID_DA_MENSAGEM', async (req, res) => {
  const { User } = req.headers;
  const { ID_DA_MENSAGEM } = req.params;

  const messageScheme = joi.object(
      {
          to: joi.string().trim().required(),
          text: joi.string().trim().required(),
          type: joi.string().trim().required()
      }
  )

  const { error } = messageScheme.validate(req.body);

  if(error){
      res.status(422).send(error.details.map(detail => detail.message));
  }

  try {
    const message = await db.collection('messages').findOne({_id: new ObjectId(ID_DA_MENSAGEM)});
    
    if(!message){
        return res.sendStatus(404);
    }
    if(message.from !== User){
      return res.sendStatus(401);
    }

    await db.collection('messages').updateOne({_id: new ObjectId(ID_DA_MENSAGEM)},
    {$set: 
        {
            to: req.body.to,
            from: User,
            text: stripHtml(req.body.text).result,
            type: req.body.type,
            time: dayjs(Date.now()).format('HH:mm:ss'),
        }
    });
    res.status(201).send("Mensagem atualizada com sucesso!")
    } catch (e){
    res.status(422).send({errorMessage: `Não foi possível alterar a mensagem: ${e}`});
}
});

setInterval(async () =>{
    try {
      const removeUsers = await db.collection("participants").find({lastStatus: {$lte: Date.now() - 10000}}).toArray();
      if(removeUsers.length !== 0){
          const removedAlert = removeUsers.map(e => {
            return{ 
              from: `System`,
              to: 'Todos', 
              text: `${e.name} sai da sala...`, 
              type: 'status', 
              time: dayjs(Date.now()).format('HH:mm:ss'),
            }
        })
        await db.collection("messages").insertMany(removedAlert);
        await db.collection("participants").deleteMany({lastStatus: {$lte: Date.now() - 10000}});
      }
    }catch(e){
      console.log("Erro ao remover inativos: ",e);
    };
},15000);

app.listen(PORT, () => { console.log(chalk.green.bold(`Rodando ${NOME} Lisu na Porta: ${PORT}`))});
