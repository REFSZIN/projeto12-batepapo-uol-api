import express, {json} from "express";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import chalk from "chalk";
import dotenv from "dotenv";
import dayjs from "dayjs";
import joi from "joi";

import { stripHtml } from "string-strip-html";
//import jwt from "jwt-simple";

const app = express();

app.use(cors());
app.use(json());
dotenv.config();

const PORT = process.env.PORTA;
const NOME = process.env.NOMEE;
let db ;

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
  const Schema = joi.object({ name: joi.string().min(3).required()});
  const valid = Schema.validate(name, {abortEarly: false});

  if(valid.errorMessage){
    const erros = validations.error.details.map((err) => err.message);
    res.status(422).send(
      `Todos os campos são obrigatórios! : ${erros}`
      ); 
    return
  };
    try {

      const newUser = await db.collection('participantes').findOne({name: name})

      if(newUser) {
        return res.status(409).send(
          `Apelido existente : ${newUser}`
          ); 
      }

      const lastStatus = Date.now();

      await db.collection("participantes").insertOne(
        {name, lastStatus}
      );
      await db.collection("mensagems").insertOne(
        {from: name, to: 'Todos', text: `${name} entra na sala...`, type: 'status', time: dayjs(Date.now()).format("HH:mm:ss")}
      );
      res.status(201).send(`Criado com sucesso: ${name} as ${lastStatus}`);
      return
    }
    catch (err) {
      console.error(err);
      res.sendStatus(500);
      return
    };
  }
);
app.get('/participants', async (req, res) => {
  try {
    await db.collection("participantes").find().toArray().then(users => {
    res.status(200).send(
      users
      ); 
    return
	});
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});
app.post('/messages', async (req, res) => {
  const{ to, text, type} = req.body;
  const { user } = req.headers;
  const Mensagem = { to, text, type, user };

  if(!user){
    res.status(404).send(
      'Usuario Inexistente ou Usuario não Preenchido!'
      ); 
    return
  };

  if(!to || !text || !type ){
    res.status(400).send(
      'Todos os campos são obrigatórios!'
      ); 
    return
  };

  const Schema = joi.object().keys({ 
    to: joi.string().min(1).trim().required(),
    text: joi.string().min(1).trim().required(),
    type: joi.string().trim().required() && type === 'message' || type === 'private_message',
    from: joi.string().min(1).trim().required(),
  });

  const result = Schema.validate(Mensagem, {abortEarly: false});

  if(result.errorMessage){
    res.status(422).send(
      'Todos os campos são obrigatórios!'
      ); 
    return
  };

  try {
    const time = dayjs().format("HH:MM:SS");
    await db.collection("mensagems").insertOne(
      {from: user , to, text, type, time}
    );

    return res.status(201).send(`Mensagem enviada sucesso ${user}`);
    
  }
  catch (error) {
    console.error(error);
    res.sendStatus(500);
    return
  };
});
app.post('/status', async (req, res) => {
  const { user } = req.headers;

  try {
    const live = await db.collection("participantes").findOne({name: user});
    const lastStatus = Date.now();

    if(!live){
      return res.status(404).send(
        'Usuario Inexistente!'
        );
    };

    await db.collection("participantes").updateOne({name: user}, { $set: {user, lastStatus} });

    return res.status(200).send(`Status Alterado com Sucesso: ${user}`);

    } catch (error) {
      console.error(err);
      res.sendStatus(500);
      return
    };
});

app.get('/messages', async (req, res) => {
  const { limit } = req.query;
  const { user } = req.headers;

  try{
    const dbTo = await db.collection("mensagems").find({to: user}).toArray();
    const dbFrom = await db.collection("mensagems").find({from: user}).toArray();
    const dbPublica = await db.collection("mensagems").find({to: "Todos"}).toArray();
    const Messages = [...new Set([...dbTo ,...dbFrom ,...dbPublica])];

    if(isNaN(limit)){
        return res.status(201).send(Messages);
    }
    res.status(201).send(Messages.splice(-limit));
    }catch(e){
    res.status(422).send({errorMessage: `Error: ${e.message}`});
  }
});

app.put('/messages/:ID_DA_MENSAGEM', async (req, res) => {
  const { User } = req.headers;
  const { ID_DA_MENSAGEM } = req.params;
  const{ to, text, type} = req.body;

  if(!User){
    res.status(404).send(
      'Usuario Inexistente ou Usuario não Preenchido!'
      ); 
    return
  };

  if(!to || !text || !type ){
    res.status(400).send(
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
    res.status(422).send(
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

  const Scheme = joi.object(
      {
          to: joi.string().trim().required(),
          text: joi.string().trim().required(),
          type: joi.string().trim().required()
      }
  )
  const { error } = Scheme.validate(req.body);

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
      const status =  Date.now() - 10000;
      const allUsers = await db.collection('participantes').find().toArray();
      const removeUsers = allUsers.filter(user => user.lastStatus <= status);

      if(removeUsers.length !== 0){
          const removedAlert = removeUsers.map(async e => {
            await db.collection("participantes").deleteOne({name: e.name});
            return{ 
              from: `System`,
              to: 'Todos', 
              text: `${e.name} sai da sala...`, 
              type: 'status',
              time: dayjs().format('HH:MM:SS')
            }
        })

        await db.collection("mensagems").insertMany(removedAlert);
      }
    }catch(e){
      console.log("Erro ao remover inativos: ", e);
    };
},15000);

app.listen(PORT, () => { console.log(chalk.green.bold(`Rodando ${NOME} Lisu na Porta: ${PORT}`))});
