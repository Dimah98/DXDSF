import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { createLogger } from '../logger';

const logger = createLogger('Swagger');

const router = Router();

// Пошук файлу openapi.json або openapi.yaml
const candidateJsonPaths = [
  path.resolve(__dirname, './openapi.json'),
  path.resolve(__dirname, '../../../docs/openapi.json'),
  path.resolve(__dirname, '../../docs/openapi.json'),
  path.resolve(__dirname, '../docs/openapi.json'),
  path.resolve(process.cwd(), 'docs/openapi.json'),
  path.resolve(process.cwd(), '../docs/openapi.json'),
  '/app/docs/openapi.json'
];

const candidateYamlPaths = [
  path.resolve(__dirname, './openapi.yaml'),
  path.resolve(__dirname, '../../../docs/openapi.yaml'),
  path.resolve(__dirname, '../../docs/openapi.yaml'),
  path.resolve(__dirname, '../docs/openapi.yaml'),
  path.resolve(process.cwd(), 'docs/openapi.yaml'),
  path.resolve(process.cwd(), '../docs/openapi.yaml'),
  '/app/docs/openapi.yaml'
];

let openapiDoc: any = null;
let foundYamlPath: string | null = null;

// Спочатку шукаємо openapi.json (прямий JSON парсинг без зовнішніх модулів)
for (const p of candidateJsonPaths) {
  if (fs.existsSync(p)) {
    try {
      const content = fs.readFileSync(p, 'utf8');
      openapiDoc = JSON.parse(content);
      logger.info(`OpenAPI JSON специфікацію успішно завантажено з: ${p}`);
      break;
    } catch (e) {
      logger.warn(`Помилка читання openapi.json за шляхом ${p}`, { error: String(e) });
    }
  }
}

// Перевіряємо наявність openapi.yaml
for (const p of candidateYamlPaths) {
  if (fs.existsSync(p)) {
    foundYamlPath = p;
    break;
  }
}

// Якщо JSON не знайдено, але є yamljs і yaml файл
if (!openapiDoc && foundYamlPath) {
  try {
    const YAML = require('yamljs');
    openapiDoc = YAML.load(foundYamlPath);
  } catch (_) {
    logger.warn('yamljs недоступний, використовується базовий документ');
  }
}

if (!openapiDoc) {
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
  if (foundYamlPath && fs.existsSync(foundYamlPath)) {
    res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
    return res.sendFile(foundYamlPath);
  }
  res.status(404).send('openapi.yaml not found on disk');
});

// 3. Інтерактивний інтерфейс Swagger UI
// Спробуємо використати swagger-ui-express якщо доступний, інакше віддаємо standalone HTML
let swaggerUiMiddleware: any = null;
try {
  const swaggerUi = require('swagger-ui-express');
  swaggerUiMiddleware = swaggerUi.setup(openapiDoc, {
    customSiteTitle: 'Sunflower Land Bot — Інтерактивна API Документація',
    customCss: `
      .swagger-ui .topbar { background-color: #0f172a; border-bottom: 2px solid #38bdf8; }
      .swagger-ui .topbar .topbar-wrapper .link { content: url('https://files.catbox.moe/9r0pip.png'); height: 40px; }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true
    }
  });
  router.use('/api-docs', swaggerUi.serve, swaggerUiMiddleware);
} catch (_) {
  // Standalone Swagger UI HTML fallback
  const html = `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sunflower Land Bot — API Документація</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; background: #fafafa; }
    .swagger-ui .topbar { background-color: #0f172a; border-bottom: 2px solid #38bdf8; }
  </style>
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js" crossorigin></script>
<script>
window.onload = () => {
  window.ui = SwaggerUIBundle({
    url: '/api-docs/openapi.json',
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset
    ],
    layout: "StandaloneLayout",
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true
  });
};
</script>
</body>
</html>`;

  router.get('/api-docs', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  });
}

export default router;
