import express, {json} from "express";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import chalk from "chalk";
import dotenv from "dotenv";
import dayjs from "dayjs";
import joi from "joi";
import { stripHtml } from "string-strip-html";

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
  const { name } = req.body;
  const Schema = joi.object({ name: joi.string().min(3).required()});
  const valid = Schema.validate(name, {abortEarly: false});

  if(name === null){
    res.status(422).send(
      `Name user is Null`
      ); 
    return
  }
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
        `Apelido existente : ${newUser}`)
    };

    const lastStatus = Date.now();

    await db.collection("participantes").insertOne(
      {name, lastStatus}
    );

    await db.collection("mensagems").insertOne(
      {from: name, to: 'Todos', text: `entra na sala...`, type: 'status', time: dayjs(Date.now()).format("HH:mm:ss")}
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
    return}
    );
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
    const time = dayjs(Date.now()).format("HH:MM:ss");
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
        )
    };

    await db.collection("participantes").updateOne({name: user}, { $set: {user, lastStatus} });

    return res.status(200).send(`Status Alterado com Sucesso: ${user}`);

    } catch (error) {
      console.error(err);
      res.sendStatus(500);
      return
    };
});
app.put('/messages/:ID_DA_MENSAGEM', async (req, res) => {
  const { user } = req.headers;
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
    const message = await db.collection('mensagems').findOne({_id: new ObjectId(ID_DA_MENSAGEM)});
    
    if(!message){
      return res.sendStatus(404);
    }
    if(message.from !== user){
      return res.sendStatus(401);
    }

    await db.collection('mensagems').updateOne({_id: new ObjectId(ID_DA_MENSAGEM)},
    {$set: 
      {
        to: req.body.to,
        from: user,
        text: stripHtml(req.body.text).result,
        type: req.body.type,
        time: dayjs(Date.now()).format('HH:MM:ss'),
      }
    });
    res.status(201).send("Mensagem atualizada com sucesso!")
    } catch (e){
    res.status(422).send(`Não foi possível alterar a mensagem: ${e}`);
}
});
app.get('/messages', async (req, res) => {
  const { limit } = req.query;
  const { user } = req.headers;

  try{
  let menssagens;

    if(limit){
      menssagens = await db.collection("mensagems").find({}, { limit: limit }).toArray();
    } else {
      menssagens = await db.collection("mensagems").find({}).toArray();
    }
    const filteredMsgs = menssagens.filter(item => item.to === user || item.to === "Todos" || item.from === user || item.from === "System");

    return res.status(201).send(filteredMsgs);

    }catch(e){
    res.status(422).send({errorMessage: `Error: ${e.message}`});
  }
});
app.delete('/messages/:ID_DA_MENSAGEM', async (req, res) => {
  const { user } = req.headers;
  const { ID_DA_MENSAGEM } = req.params;

  if(!user){
    res.status(404).send(
      'Usuario Inexistente ou Usuario não Preenchido!'
      ); 
    return
  };

  try {
    const message = await db.collection('mensagems').findOne({_id: ObjectId(`${ID_DA_MENSAGEM}`)});
    
    if(!message){
      return res.sendStatus(404);
    }
    if(message.from !== user){
      return res.sendStatus(401);
    }
    await db.collection('mensagems').deleteOne({_id: ObjectId(`${ID_DA_MENSAGEM}`)});
    res.sendStatus(200);
    } catch(e) {
      res.status(500).send({errorMessage: `Não foi possível deletar a mensagem! Causa: ${e}`});
    }
});

setInterval(async () =>{
  try {
    const status =  Date.now() - 10000;
    const allUsers = await db.collection('participantes').find().toArray();
    const removeUsers = allUsers.filter(user => {
      return user.lastStatus === status || user.lastStatus < status
    });

    if(removeUsers.length !== 0){
      removeUsers.map(async e => {
        const msg = { 
          from: "System",
          to: "Todos",
          text: `${e.name} sai da sala...`, 
          type: 'status',
          time: dayjs().format('HH:MM:ss')
        };
        await db.collection("mensagems").insertOne(msg);
        await db.collection("participantes").deleteOne({name: e.name});
    })}
  }catch(e){
    console.log("Erro ao remover inativos: ", e);
  };
},15000);

app.listen(PORT, () => { console.log(chalk.green.bold(`Rodando ${NOME} Lisu na Porta: ${PORT}`))});
