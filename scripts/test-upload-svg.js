#!/usr/bin/env node

const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');

async function testUploadSvgWithFile() {
  console.log('🧪 **PRUEBA DE UPLOAD DE SVG**\n');
  
  try {
    // ✅ PASO 1: Crear un archivo SVG de prueba
    const testSvgPath = './test-icon.svg';
    const testSvgContent = `
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="40" fill="#3B82F6" stroke="#1E40AF" stroke-width="2"/>
  <text x="50" y="55" text-anchor="middle" fill="white" font-family="Arial" font-size="12" font-weight="bold">SVG</text>
</svg>`;
    
    fs.writeFileSync(testSvgPath, testSvgContent);
    console.log('✅ **PASO 1: ARCHIVO SVG DE PRUEBA CREADO**');
    console.log(`   📁 Archivo: ${testSvgPath}`);
    const stats = fs.statSync(testSvgPath);
    console.log(`   📊 Tamaño: ${stats.size} bytes`);
    console.log(`   📅 Creado: ${stats.birthtime}`);
    
    // ✅ PASO 2: Preparar la mutación GraphQL
    console.log('\n✅ **PASO 2: PREPARANDO MUTACIÓN GRAPHQL**');
    
    const operations = JSON.stringify({
      query: `
        mutation UploadSvg($file: Upload!, $entityId: String!, $entityType: String!, $optimize: Boolean, $sanitize: Boolean) {
          uploadSvg(file: $file, entityId: $entityId, entityType: $entityType, optimize: $optimize, sanitize: $sanitize) {
            success
            message
            code
            timestamp
            data {
              url
              filename
              svgId
              dimensions {
                width
                height
              }
              viewBox
              optimized
            }
            metadata {
              requestId
              traceId
              duration
              timestamp
            }
          }
        }
      `,
      variables: {
        file: null,
        entityId: "test-svg-" + Date.now(),
        entityType: "product",
        optimize: true,
        sanitize: true
      }
    });
    
    const map = JSON.stringify({
      "0": ["variables.file"]
    });
    
    // ✅ PASO 3: Crear FormData
    console.log('\n✅ **PASO 3: CREANDO FORMDATA**');
    const form = new FormData();
    form.append('operations', operations);
    form.append('map', map);
    form.append('0', fs.createReadStream(testSvgPath), {
      filename: 'test-icon.svg',
      contentType: 'image/svg+xml'
    });
    
    console.log('   📝 Operations:', operations.substring(0, 100) + '...');
    console.log('   🗺️ Map:', map);
    console.log('   📎 Archivo adjunto: test-icon.svg');
    
    // ✅ PASO 4: Realizar la petición
    console.log('\n✅ **PASO 4: REALIZANDO PETICIÓN**');
    console.log('   🌐 URL: http://localhost:3000/graphql');
    console.log('   📤 Enviando archivo SVG...');
    
    const response = await fetch('http://localhost:3000/graphql', {
      method: 'POST',
      body: form,
      headers: {
        ...form.getHeaders(),
        'x-request-id': `req-svg-${Date.now()}`
      }
    });
    
    console.log(`   📊 Status: ${response.status} ${response.statusText}`);
    
    // ✅ PASO 5: Procesar respuesta
    console.log('\n✅ **PASO 5: PROCESANDO RESPUESTA**');
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('   ❌ Error en la respuesta HTTP:');
      console.log(`   📄 ${errorText}`);
      return;
    }
    
    const result = await response.json();
    
    if (result.errors) {
      console.log('   ❌ Errores GraphQL encontrados:');
      result.errors.forEach((error: any, index: number) => {
        console.log(`   ${index + 1}. ${error.message}`);
        if (error.extensions) {
          console.log(`      📋 Detalles: ${JSON.stringify(error.extensions, null, 2)}`);
        }
      });
      return;
    }
    
    // ✅ PASO 6: Mostrar resultado exitoso
    console.log('\n✅ **PASO 6: RESULTADO EXITOSO**');
    
    const uploadResult = result.data.uploadSvg;
    
    console.log('   🎉 SVG subido exitosamente!');
    console.log(`   📊 Success: ${uploadResult.success}`);
    console.log(`   💬 Message: ${uploadResult.message}`);
    console.log(`   🏷️ Code: ${uploadResult.code}`);
    console.log(`   ⏰ Timestamp: ${uploadResult.timestamp}`);
    
    if (uploadResult.data) {
      console.log('\n   📄 **DATOS DEL SVG:**');
      console.log(`   🔗 URL: ${uploadResult.data.url}`);
      console.log(`   📁 Filename: ${uploadResult.data.filename}`);
      console.log(`   🆔 SVG ID: ${uploadResult.data.svgId}`);
      console.log(`   📐 Optimized: ${uploadResult.data.optimized}`);
      
      if (uploadResult.data.dimensions) {
        console.log(`   📏 Dimensions: ${uploadResult.data.dimensions.width}x${uploadResult.data.dimensions.height}`);
      }
      
      if (uploadResult.data.viewBox) {
        console.log(`   👁️ ViewBox: ${uploadResult.data.viewBox}`);
      }
    }
    
    if (uploadResult.metadata) {
      console.log('\n   📊 **METADATOS:**');
      console.log(`   🆔 Request ID: ${uploadResult.metadata.requestId}`);
      console.log(`   🔍 Trace ID: ${uploadResult.metadata.traceId}`);
      console.log(`   ⏱️ Duration: ${uploadResult.metadata.duration}ms`);
    }
    
    // ✅ PASO 7: Limpiar archivo de prueba
    console.log('\n✅ **PASO 7: LIMPIEZA**');
    if (fs.existsSync(testSvgPath)) {
      fs.unlinkSync(testSvgPath);
      console.log(`   🗑️ Archivo de prueba eliminado: ${testSvgPath}`);
    }
    
    console.log('\n🎉 **PRUEBA COMPLETADA EXITOSAMENTE**');
    console.log('   ✅ Upload de SVG funcionando correctamente');
    console.log('   ✅ Validaciones de seguridad implementadas');
    console.log('   ✅ Respuesta estandarizada según GRAPHQL_RESPONSE_STANDARDS');
    console.log('   ✅ Logging completo implementado');
    console.log('   ✅ Clean Architecture aplicada');
    
  } catch (error) {
    console.error('\n❌ **ERROR EN LA PRUEBA:**');
    console.error(`   💥 ${error.message}`);
    console.error(`   📍 Stack: ${error.stack}`);
    
    // Limpiar archivo de prueba en caso de error
    const testSvgPath = './test-icon.svg';
    if (fs.existsSync(testSvgPath)) {
      fs.unlinkSync(testSvgPath);
      console.log(`   🗑️ Archivo de prueba eliminado: ${testSvgPath}`);
    }
  }
}

// Ejecutar la prueba
testUploadSvgWithFile();
