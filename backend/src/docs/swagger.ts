import { Router, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import fs from 'fs';
import { createLogger } from '../logger';

const logger = createLogger('Swagger');

const router = Router();

// Пошук файлу openapi.yaml у різних можливих локаціях (локально та в Docker)
const candidatePaths = [
  path.resolve(__dirname, '../../../docs/openapi.yaml'),
  path.resolve(__dirname, '../../docs/openapi.yaml'),
  path.resolve(__dirname, '../docs/openapi.yaml'),
  path.resolve(process.cwd(), 'docs/openapi.yaml'),
  path.resolve(process.cwd(), '../docs/openapi.yaml'),
  '/app/docs/openapi.yaml'
];

let openapiDoc: any = null;
let foundPath: string | null = null;

for (const p of candidatePaths) {
  if (fs.existsSync(p)) {
    try {
      openapiDoc = YAML.load(p);
      foundPath = p;
      logger.info(`OpenAPI специфікацію успішно завантажено з: ${p}`);
      break;
    } catch (e) {
      logger.warn(`Помилка парсингу openapi.yaml за шляхом ${p}`, { error: String(e) });
    }
  }
}

if (!openapiDoc) {
  logger.warn('Файл openapi.yaml не знайдено за стандартними шляхами. Створено базовий заглушковий документ.');
  openapiDoc = {
    openapi: '3.0.3',
    info: {
      title: 'Sunflower Land Bot Constructor API',
      version: '1.0.0',
      description: 'API специфікація доступна у каталозі /docs'
    },
    paths: {}
  };
}

// 1. Віддача сирої OpenAPI специфікації у форматі JSON
router.get('/api-docs/openapi.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(openapiDoc);
});

// 2. Віддача сирої OpenAPI специфікації у форматі YAML
router.get('/api-docs/openapi.yaml', (_req: Request, res: Response) => {
  if (foundPath && fs.existsSync(foundPath)) {
    res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
    return res.sendFile(foundPath);
  }
  res.status(404).send('openapi.yaml not found on disk');
});

// 3. Інтерактивний інтерфейс Swagger UI
router.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(openapiDoc, {
    customSiteTitle: 'Sunflower Land Bot — Інтерактивна API Документація',
    customCss: `
      .swagger-ui .topbar { background-color: #0f172a; border-bottom: 2px solid #38bdf8; }
      .swagger-ui .topbar .topbar-wrapper .link { content: url('https://files.catbox.moe/9r0pip.png'); height: 40px; }
      .swagger-ui .info { margin: 20px 0; }
      .swagger-ui .info .title { color: #0284c7; }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true
    }
  })
);

export default router;
