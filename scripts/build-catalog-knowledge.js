#!/usr/bin/env node
'use strict';

// Gera a base documental compacta usada pela IA interna. O conteúdo nunca é
// inventado: cada trecho vem de uma página e preserva nome/hash do PDF fonte.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const textDir = path.join(root, 'tmp', 'pdfs');
const pdfDir = process.env.CATALOG_PDF_DIR || path.resolve(root, '..', '..', 'upload');
const outDir = path.join(root, 'data', 'catalogos-ia');

const specs = [
  { id:'rainha-sete', nome:'Rainha das Sete', aliases:['rainha','rainha das sete'], pdf:'367-Rainha-da-Sete.pdf', text:'rainha_sete.txt', extracao:'texto', paginasPdf:385 },
  { id:'aje', nome:'AJE Peças', aliases:['aje','industria de acessorios automobilisticos'], pdf:'100172-AJE-pecas.pdf', text:'aje_ocr.txt', extracao:'ocr', paginasPdf:30 },
  { id:'wahler', nome:'Wahler Original', aliases:['wahler','borgwarner wahler'], pdf:'100171-Wahler-Original.pdf', text:'wahler.txt', extracao:'texto', paginasPdf:248 },
  { id:'dni', nome:'DNI', aliases:['dni','dni automotive'], pdf:'Catalogo-DNI.pdf', text:'dni_ocr.txt', extracao:'ocr', paginasPdf:204 },
  { id:'nytron', nome:'Nytron', aliases:['nytron','ny nytron'], pdf:'383-Nytron.pdf', text:'nytron.txt', extracao:'texto', paginasPdf:120 },
  { id:'ranalle', nome:'Ranalle', aliases:['ranalle'], pdf:'6052-Ranalle.pdf', text:'ranalle_ocr.txt', extracao:'ocr', paginasPdf:94 },
  { id:'dpl', nome:'DPL / Forcecar', aliases:['dpl','forcecar','bauen'], pdf:'6089-DPL.pdf', text:'dpl_ocr.txt', extracao:'ocr', paginasPdf:118 },
  { id:'brk', nome:'BRK BrasilKits', aliases:['brk','brasilkits','brasil kits'], pdf:'6078-BRK.pdf', text:'brk.txt', extracao:'texto', paginasPdf:84 },
  { id:'jurid', nome:'Jurid', aliases:['jurid','federal mogul jurid'], pdf:'6054-Jurid.pdf', text:'jurid.txt', extracao:'texto', paginasPdf:120 },
  { id:'ds-2025', nome:'DS Automotive 2025', aliases:['ds','ds automotive','ds 2025'], pdf:'Catalogo_Completo_2025.pdf', text:'catalogo_2025.txt', extracao:'texto', paginasPdf:320 }
];

const stop = new Set(['para','com','sem','uma','uns','das','dos','de','da','do','em','no','na','nos','nas','por','que','the','and','del','las','los','catalogo','pagina','produto','produtos']);
function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9./+\-\s]/g,' ').replace(/\s+/g,' ').trim();}
function usefulLine(line){
  const s=String(line||'').replace(/\u0000/g,'').replace(/\s+/g,' ').trim();
  if(!s || !/[A-Za-zÀ-ÿ0-9]/.test(s)) return '';
  const alnum=(s.match(/[A-Za-zÀ-ÿ0-9]/g)||[]).length;
  if(alnum<2 || alnum/Math.max(1,s.length)<0.32) return '';
  return s;
}
function cleanPage(raw){
  const out=[];
  for(const line of String(raw||'').split(/\r?\n/)){
    const s=usefulLine(line);
    if(!s) continue;
    if(out[out.length-1]===s) continue;
    out.push(s);
  }
  return out.join(' | ').replace(/\s+\|\s+/g,' | ').trim();
}
function sha256(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function lexicon(text){
  const freq=new Map();
  norm(text).split(/\s+/).forEach(t=>{
    if(t.length<3 || t.length>28 || stop.has(t)) return;
    freq.set(t,(freq.get(t)||0)+1);
  });
  return [...freq.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,3500).map(([t])=>t);
}
function codes(text){
  const matches=String(text||'').toUpperCase().match(/[A-Z0-9][A-Z0-9./-]{2,20}/g)||[];
  return [...new Set(matches.map(v=>norm(v).replace(/[^a-z0-9]/g,'')).filter(v=>v.length>=3&&v.length<=20&&/\d/.test(v)))];
}

fs.mkdirSync(outDir,{recursive:true});
const manifest={
  versao:1,
  geradoEm:new Date().toISOString(),
  regra:'Conteúdo documental por página; nenhuma compatibilidade é inferida sem texto correspondente no catálogo.',
  fontes:[],
  codigoFontes:{}
};
let totalPages=0,totalChars=0;

for(const spec of specs){
  const textPath=path.join(textDir,spec.text);
  const pdfPath=path.join(pdfDir,spec.pdf);
  if(!fs.existsSync(textPath)) throw new Error('Texto ausente: '+textPath);
  if(!fs.existsSync(pdfPath)) throw new Error('PDF ausente: '+pdfPath);
  const raw=fs.readFileSync(textPath,'utf8').replace(/\r/g,'');
  const parts=raw.split('\f');
  const paginas=[];
  const all=[];
  parts.forEach((part,i)=>{
    const texto=cleanPage(part);
    if(!texto) return;
    paginas.push({pagina:i+1,texto});
    all.push(texto);
  });
  const joined=all.join(' ');
  const fonte={
    id:spec.id,nome:spec.nome,aliases:spec.aliases,pdf:spec.pdf,
    sha256:sha256(pdfPath),extracao:spec.extracao,paginasPdf:spec.paginasPdf,
    paginasComTexto:paginas.length
  };
  const data={versao:1,fonte,paginas};
  const fileName=spec.id+'.json';
  fs.writeFileSync(path.join(outDir,fileName),JSON.stringify(data));
  const sourceMeta={...fonte,arquivoDados:'data/catalogos-ia/'+fileName,lexico:lexicon(joined)};
  manifest.fontes.push(sourceMeta);
  codes(joined).forEach(code=>{
    const ids=manifest.codigoFontes[code]||(manifest.codigoFontes[code]=[]);
    if(!ids.includes(spec.id)) ids.push(spec.id);
  });
  totalPages+=paginas.length;
  totalChars+=joined.length;
}

fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify(manifest));
process.stdout.write(JSON.stringify({fontes:manifest.fontes.length,paginasComTexto:totalPages,caracteres:totalChars,codigos:Object.keys(manifest.codigoFontes).length},null,2)+'\n');
