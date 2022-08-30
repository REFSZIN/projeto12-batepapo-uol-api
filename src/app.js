import express, {json} from "express";
import cors from "cors";
import chalk from "chalk";
import dotenv from "dotenv"
//import jwt from "jwt-simple";

dotenv.config()

const app = express();

const PORT = process.env.PORTA;

const NOME = process.env.NOMEE;

app.use(cors());
app.use(json());


app.listen(PORT, () => { console.log(chalk.green.bold(`Rodando ${NOME} Lisu na Porta: ${PORT}`))});
