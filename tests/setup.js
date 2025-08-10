"use strict";
// Configuración global de Jest
/// <reference types="jest" />
// Configurar variables de entorno para tests
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
// No Supabase variables needed; removed legacy placeholders
// Configurar timeouts
jest.setTimeout(10000);
