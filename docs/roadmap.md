# Roadmap та технічний борг

## Загальний огляд

Цей документ містить список потенційних покращень, технічного боргу та майбутніх фіч на основі аналізу коду та коментарів розробників.

---

## Критичні покращення (High Priority)

### 1. Перехід з JSON файлів на базу даних

**Поточна ситуація**: Всі дані зберігаються в JSON файлах

**Проблеми**:
- Немає ACID гарантій
- Можливі race conditions при паралельному запису
- Лінійний пошук O(n) для списку проєктів
- Немає транзакцій

**Рішення**:
- [ ] Розглянути PostgreSQL або MongoDB
- [ ] Створити міграційний скрипт
- [ ] Реалізувати Repository pattern
- [ ] Додати connection pooling

**Оцінка**: 2-3 тижні  
**Пріоритет**: High

---

### 2. Покращення системи автентифікації

**Поточна ситуація**: JWT + CSRF токени реалізовані, але немає endpoints для login/logout

**Проблеми**:
- Немає endpoint для отримання JWT токену
- Немає endpoint для отримання CSRF токену
- Немає refresh token mechanism
- Немає user management

**Рішення**:
- [ ] Створити POST /api/auth/login endpoint
- [ ] Створити POST /api/auth/logout endpoint
- [ ] Створити POST /api/auth/refresh endpoint
- [ ] Реалізувати user registration
- [ ] Додати password hashing (bcrypt)
- [ ] Реалізувати role-based access control (RBAC)

**Оцінка**: 1 тиждень  
**Пріоритет**: High

---

### 3. Error Handling та Logging

**Поточна ситуація**: Logger реалізований, але не всі помилки логуються коректно

**Проблеми**:
- Деякі помилки логуються як строки замість Error об'єктів
- Немає централізованого error tracking
- Немає log rotation
- Логи зберігаються лише в JSON файлах

**Рішення**:
- [ ] Інтегрувати Sentry або аналог для error tracking
- [ ] Додати log rotation (Winston або Pino)
- [ ] Стандартизувати error handling patterns
- [ ] Додати structured logging metadata
- [ ] Реалізувати log aggregation (ELK stack або Loki)

**Оцінка**: 1 тиждень  
**Пріоритет**: Medium-High

---

## Функціональні покращення (Medium Priority)

### 4. Routing та навігація (Frontend)

**Поточна ситуація**: Single page application без routing

**Проблеми**:
- Всі функції в одній сторінці через модалі
- Немає deep linking
- Неможливо поділитися прямим посиланням на проєкт

**Рішення**:
- [ ] Додати React Router
- [ ] Створити маршрути:
  - `/` - Головна сторінка
  - `/projects` - Список проєктів
  - `/project/:id` - Редактор проєкту
  - `/settings` - Налаштування
  - `/statistics` - Глобальна статистика
  - `/inventory` - Inventory overview
- [ ] Реалізувати breadcrumbs
- [ ] Додати навігаційне меню

**Оцінка**: 3-5 днів  
**Пріоритет**: Medium

---

### 5. Dark Mode

**Поточна ситуація**: Потребує уточнення чи реалізовано

**Рішення**:
- [ ] Реалізувати dark mode через Tailwind
- [ ] Додати toggle в Settings
- [ ] Зберігати перевагу в localStorage
- [ ] Синхронізувати з system preferences

**Оцінка**: 2-3 дні  
**Пріоритет**: Medium

---

### 6. Проект версіонування

**Поточна ситуація**: Немає історії змін проєктів

**Проблеми**:
- Неможливо відкотити до попередньої версії
- Немає audit trail

**Рішення**:
- [ ] Додати Git integration для проєктів
- [ ] Реалізувати snapshot механізм
- [ ] Створити UI для перегляду історії
- [ ] Додати commit messages
- [ ] Реалізувати diff viewer для порівняння версій

**Оцінка**: 1-2 тижні  
**Пріоритет**: Medium

---

### 7. Export/Import проєктів

**Поточна ситуація**: Частково реалізовано (через JSON файли)

**Покращення**:
- [ ] Додати UI для export/import
- [ ] Підтримка різних форматів (JSON, YAML)
- [ ] Bulk export (кілька проєктів в ZIP)
- [ ] Import validation
- [ ] Merge conflicts resolution

**Оцінка**: 3-5 днів  
**Пріоритет**: Medium

---

### 8. Node Library та Custom Nodes

**Поточна ситуація**: 30+ built-in нод

**Покращення**:
- [ ] Додати можливість створення custom nodes через UI
- [ ] JavaScript/TypeScript node для виконання коду
- [ ] Node marketplace (sharing nodes between users)
- [ ] Node templates library
- [ ] Visual node builder

**Оцінка**: 2-3 тижні  
**Пріоритет**: Medium

---

### 9. Collaborative Editing

**Поточна ситуація**: Single-user editing

**Покращення**:
- [ ] Real-time collaborative editing (CRDT)
- [ ] User cursors та присутність
- [ ] Commenting система
- [ ] Lock mechanism для запобігання конфліктів
- [ ] Activity log

**Оцінка**: 3-4 тижні  
**Пріоритет**: Low-Medium

---

## Покращення продуктивності (Medium Priority)

### 10. Кешування

**Поточна ситуація**: Немає кешування

**Рішення**:
- [ ] Додати Redis для session state
- [ ] Кешувати часто використовувані проєкти
- [ ] HTTP caching headers для статичних ресурсів
- [ ] In-memory cache для метаданих проєктів
- [ ] CDN для frontend assets

**Оцінка**: 1 тиждень  
**Пріоритет**: Medium

---

### 11. Оптимізація відеопотоку

**Поточна ситуація**: Base64 JPEG кадри через WebSocket (~200ms)

**Проблеми**:
- Великий розмір даних
- Можлива затримка при поганому з'єднанні

**Рішення**:
- [ ] WebRTC для відеопотоку
- [ ] Adaptive bitrate (adjustable quality)
- [ ] WebP або AVIF замість JPEG
- [ ] Delta compression (відправка лише змінених частин)
- [ ] Framerate throttling based on activity

**Оцінка**: 1-2 тижні  
**Пріоритет**: Medium

---

### 12. Database Indexing

**Після переходу на БД**:
- [ ] Індекси на projectName
- [ ] Індекси на timestamp для логів/статистики
- [ ] Full-text search індекси
- [ ] Composite індекси для складних запитів

**Оцінка**: 2-3 дні  
**Пріоритет**: Medium (після переходу на БД)

---

## Безпека (High Priority)

### 13. Secrets Management

**Поточна ситуація**: SecretsManager реалізований, але не повністю інтегрований

**Покращення**:
- [ ] Encrypt sensitive data at rest
- [ ] Інтеграція з AWS Secrets Manager або HashiCorp Vault
- [ ] Rotate secrets автоматично
- [ ] Audit log для доступу до секретів

**Оцінка**: 1 тиждень  
**Пріоритет**: High

---

### 14. Input Validation

**Поточна ситуація**: InputValidator реалізований для project names

**Покращення**:
- [ ] Розширити валідацію на всі endpoints
- [ ] Joi або Zod схеми для request validation
- [ ] Sanitization для HTML/SQL injection
- [ ] File upload validation (якщо буде додано)

**Оцінка**: 3-5 днів  
**Пріоритет**: High

---

### 15. HTTPS та Security Headers

**Поточна ситуація**: HTTP в development, SecurityHeadersMiddleware реалізований

**Покращення**:
- [ ] Enforced HTTPS в production
- [ ] HSTS header
- [ ] CSP (Content Security Policy) більш строгий
- [ ] Certificate management (Let's Encrypt)

**Оцінка**: 2-3 дні  
**Пріоритет**: High (для production)

---

## Тестування (Medium-High Priority)

### 16. Розширення test coverage

**Поточна ситуація**: Частково покрито тестами (Vitest, fast-check)

**Покращення**:
- [ ] Збільшити test coverage до >80%
- [ ] Integration tests для всіх API endpoints
- [ ] E2E tests (Playwright або Cypress)
- [ ] Visual regression tests для UI
- [ ] Load testing (k6 або Artillery)
- [ ] Property-based tests для всіх handlers

**Оцінка**: 2-3 тижні  
**Пріоритет**: Medium-High

---

### 17. CI/CD Pipeline

**Поточна ситуація**: Немає CI/CD

**Рішення**:
- [ ] GitHub Actions або GitLab CI
- [ ] Automated testing на кожен commit
- [ ] Code quality checks (ESLint, TypeScript strict)
- [ ] Dependency vulnerability scanning
- [ ] Automated deployment до staging/production
- [ ] Docker containerization
- [ ] Kubernetes deployment (для масштабування)

**Оцінка**: 1 тиждень  
**Пріоритет**: Medium-High

---

## UX/UI покращення (Medium Priority)

### 18. Keyboard Shortcuts

**Поточна ситуація**: Частково реалізовано (Ctrl+C, Ctrl+V, Ctrl+Z)

**Покращення**:
- [ ] Додати hotkeys menu (?)
- [ ] Customizable shortcuts
- [ ] Shortcuts для всіх операцій:
  - Ctrl+S - Save
  - Ctrl+N - New project
  - Ctrl+O - Open project
  - Ctrl+F - Find node
  - Delete - Delete selected nodes
  - Space+Drag - Pan canvas
  - Ctrl+Scroll - Zoom

**Оцінка**: 2-3 дні  
**Пріоритет**: Medium

---

### 19. Node Search та Filtering

**Поточна ситуація**: Немає пошуку

**Покращення**:
- [ ] Search box для нод в Sidebar
- [ ] Search nodes на canvas
- [ ] Filter by category
- [ ] Recent nodes list
- [ ] Favorites/bookmarks

**Оцінка**: 2-3 дні  
**Пріоритет**: Medium

---

### 20. Canvas Improvements

**Поточна ситуація**: Базовий React Flow

**Покращення**:
- [ ] Mini-map
- [ ] Grid snapping
- [ ] Node alignment tools (align left, center, distribute)
- [ ] Multi-select з Shift/Ctrl
- [ ] Group selection box
- [ ] Zoom to selection
- [ ] Canvas background patterns

**Оцінка**: 1 тиждень  
**Пріоритет**: Medium

---

### 21. Node Connection Validation

**Поточна ситуація**: Базова валідація

**Покращення**:
- [ ] Strict type checking для connections
- [ ] Visual indicators для incompatible connections
- [ ] Port tooltips з описом
- [ ] Auto-routing для edges (уникнення перетинів)

**Оцінка**: 3-5 днів  
**Пріоритет**: Medium

---

## Документація (Medium Priority)

### 22. API Documentation

**Поточна ситуація**: Документація в docs/api.md

**Покращення**:
- [ ] OpenAPI/Swagger specification
- [ ] Interactive API docs (Swagger UI)
- [ ] Postman collection
- [ ] Code examples для кожного endpoint
- [ ] API versioning

**Оцінка**: 3-5 днів  
**Пріоритет**: Medium

---

### 23. User Guide

**Поточна ситуація**: README.md з основною інформацією

**Покращення**:
- [ ] Step-by-step tutorials
- [ ] Video guides (screencasts)
- [ ] Use case examples
- [ ] Troubleshooting guide
- [ ] FAQ

**Оцінка**: 1-2 тижні  
**Пріоритет**: Medium

---

### 24. Developer Documentation

**Поточна ситуація**: AI_CONTEXT.md та docs/

**Покращення**:
- [ ] Contributing guidelines
- [ ] Code style guide
- [ ] Architecture decision records (ADR)
- [ ] How to add new node types
- [ ] API integration guide
- [ ] Deployment guide

**Оцінка**: 1 тиждень  
**Пріоритет**: Medium

---

## Моніторинг та Аналітика (Low-Medium Priority)

### 25. Application Monitoring

**Поточна ситуація**: Базовий health check endpoint

**Покращення**:
- [ ] Prometheus metrics
- [ ] Grafana dashboards
- [ ] Application Performance Monitoring (APM)
- [ ] Error rate tracking
- [ ] Response time metrics
- [ ] Resource usage graphs

**Оцінка**: 1 тиждень  
**Пріоритет**: Low-Medium

---

### 26. Usage Analytics

**Покращення**:
- [ ] User behavior tracking (анонімізовано)
- [ ] Popular nodes statistics
- [ ] Session duration analytics
- [ ] Error funnel analysis
- [ ] Feature usage heatmap

**Оцінка**: 3-5 днів  
**Пріоритет**: Low

---

## Інтеграції (Low Priority)

### 27. Third-party Integrations

**Покращення**:
- [ ] Google Sheets integration
- [ ] Slack notifications
- [ ] Discord webhooks
- [ ] Email notifications (SendGrid)
- [ ] Zapier integration
- [ ] GitHub Actions integration

**Оцінка**: 2-3 тижні  
**Пріоритет**: Low

---

### 28. AI/ML Features

**Покращення**:
- [ ] AI-assisted node suggestion
- [ ] Auto-complete для selectors
- [ ] Anomaly detection в логах
- [ ] Predictive analytics для сценаріїв
- [ ] Natural language query для створення flows

**Оцінка**: 4-6 тижнів  
**Пріоритет**: Low (майбутнє)

---

## Технічний борг (з коду)

### Знайдені TODO/FIXME

1. **Inventory Overview Auth** (backend/src/index.ts:851)
   - `Note: Auth temporarily disabled for easier testing - add back in production`
   - **Action**: Увімкнути authentication для /api/inventory/overview

2. **WebSocket Lifecycle Comments** (backend/src/index.ts:1565, 1581)
   - `Note: WebSocketLifecycle handles session.activeWs cleanup and removeAllListeners`
   - **Action**: Переконатися що cleanup працює коректно

3. **Path Traversal Testing** (backend/src/inventory-api.test.ts:174)
   - `Note: Express URL-encodes path parameters, so we test the validation directly`
   - **Action**: Додати більше security tests

4. **JWT_SECRET та ENCRYPTION_KEY** (backend/src/config/ConfigManager.test.ts:6)
   - `Note: These tests assume JWT_SECRET and ENCRYPTION_KEY are set in .env`
   - **Action**: Додати .env.test з тестовими значеннями

---

## Пріоритизація

### Must Have (Q2 2026)
1. База даних замість JSON
2. Повноцінна автентифікація (login/logout/refresh)
3. HTTPS та production security
4. Error tracking (Sentry)

### Should Have (Q3 2026)
5. Routing та навігація
6. Dark mode
7. Node versioning
8. Extended test coverage
9. CI/CD pipeline

### Nice to Have (Q4 2026)
10. Collaborative editing
11. Custom nodes builder
12. WebRTC для відеопотоку
13. AI/ML features

### Future (2027+)
14. Marketplace для нод
15. Mobile app (React Native)
16. Cloud hosting service
17. Enterprise features (SAML SSO, audit logs)

---

## Метрики успіху

- **Test coverage**: >80%
- **API response time**: <200ms (p95)
- **Uptime**: >99.5%
- **Time to first byte (TTFB)**: <100ms
- **Lighthouse score**: >90
- **Vulnerabilities**: 0 critical, 0 high

---

**Дата створення**: 2026-06-08  
**Версія**: 1.0  
**Останнє оновлення**: 2026-06-08
