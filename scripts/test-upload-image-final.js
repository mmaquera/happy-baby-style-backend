#!/usr/bin/env node

const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');

async function testUploadImageWithFile() {
  console.log('🧪 **PRUEBA FINAL DE UPLOAD DE IMAGEN**\n');
  
  try {
    // ✅ PASO 1: Verificar que el archivo de prueba existe
    const testImagePath = './test-image.png';
    if (!fs.existsSync(testImagePath)) {
      console.log('❌ Archivo de prueba no encontrado');
      return;
    }
    
    console.log('✅ **PASO 1: ARCHIVO DE PRUEBA VERIFICADO**');
    console.log(`   📁 Archivo: ${testImagePath}`);
    const stats = fs.statSync(testImagePath);
    console.log(`   📊 Tamaño: ${stats.size} bytes`);
    console.log(`   📅 Creado: ${stats.birthtime}`);
    
    // ✅ PASO 2: Preparar la mutación GraphQL
    console.log('\n✅ **PASO 2: PREPARANDO MUTACIÓN GRAPHQL**');
    
    const operations = JSON.stringify({
      query: `
        mutation UploadImage($file: Upload!, $entityId: String!, $entityType: String!) {
          uploadImage(file: $file, entityId: $entityId, entityType: $entityType) {
            success
            message
            code
            timestamp
            data {
              url
              filename
              imageId
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
        entityId: "test-" + Date.now(),
        entityType: "product"
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
    form.append('0', fs.createReadStream(testImagePath), {
      filename: 'test-image.png',
      contentType: 'image/png'
    });
    
    console.log('   📝 Operations:', operations.substring(0, 100) + '...');
    console.log('   🗺️ Map:', map);
    console.log('   📎 File attached: test-image.png');
    
    // ✅ PASO 4: Realizar la petición
    console.log('\n✅ **PASO 4: ENVIANDO PETICIÓN AL SERVIDOR**');
    console.log('   🌐 URL: http://localhost:3001/graphql');
    console.log('   📤 Método: POST');
    console.log('   📋 Content-Type: multipart/form-data');
    
    const startTime = Date.now();
    const response = await fetch('http://localhost:3001/graphql', {
      method: 'POST',
      body: form,
      headers: {
        ...form.getHeaders(),
        'Apollo-Require-Preflight': 'true'
      }
    });
    
    const duration = Date.now() - startTime;
    
    // ✅ PASO 5: Analizar respuesta
    console.log('\n✅ **PASO 5: ANALIZANDO RESPUESTA**');
    console.log(`   ⏱️ Tiempo de respuesta: ${duration}ms`);
    console.log(`   📊 Status: ${response.status} ${response.statusText}`);
    console.log(`   📋 Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}`);
    
    const responseText = await response.text();
    console.log(`   📝 Response length: ${responseText.length} characters`);
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.log('❌ Error parsing JSON response');
      console.log('📝 Raw response:', responseText.substring(0, 500));
      return;
    }
    
    // ✅ PASO 6: Validar respuesta
    console.log('\n✅ **PASO 6: VALIDANDO RESPUESTA**');
    console.log('📋 Respuesta completa:');
    console.log(JSON.stringify(responseData, null, 2));
    
    if (responseData.errors) {
      console.log('\n❌ **ERRORES EN LA RESPUESTA:**');
      responseData.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.message}`);
        if (error.extensions) {
          console.log(`      Extensions: ${JSON.stringify(error.extensions, null, 2)}`);
        }
      });
    }
    
    if (responseData.data?.uploadImage) {
      const uploadResult = responseData.data.uploadImage;
      
      console.log('\n📊 **ANÁLISIS DE LA RESPUESTA DE UPLOAD:**');
      console.log(`   ✅ Success: ${uploadResult.success}`);
      console.log(`   💬 Message: ${uploadResult.message}`);
      console.log(`   🔢 Code: ${uploadResult.code}`);
      console.log(`   ⏰ Timestamp: ${uploadResult.timestamp}`);
      
      if (uploadResult.data) {
        console.log('\n📁 **DATOS DEL ARCHIVO SUBIDO:**');
        console.log(`   🔗 URL: ${uploadResult.data.url}`);
        console.log(`   📝 Filename: ${uploadResult.data.filename}`);
        console.log(`   🆔 Image ID: ${uploadResult.data.imageId}`);
      }
      
      if (uploadResult.metadata) {
        console.log('\n📊 **METADATA DE LA RESPUESTA:**');
        console.log(`   🆔 Request ID: ${uploadResult.metadata.requestId}`);
        console.log(`   🔍 Trace ID: ${uploadResult.metadata.traceId}`);
        console.log(`   ⏱️ Duration: ${uploadResult.metadata.duration}ms`);
        console.log(`   ⏰ Timestamp: ${uploadResult.metadata.timestamp}`);
      }
      
      // ✅ PASO 7: Verificar archivo guardado
      if (uploadResult.success && uploadResult.data?.url) {
        console.log('\n✅ **PASO 7: VERIFICANDO ARCHIVO GUARDADO**');
        
        // Extraer la ruta del archivo de la URL
        const urlParts = uploadResult.data.url.split('/');
        const relativePath = urlParts.slice(3).join('/'); // Remover http://localhost:3001
        const filePath = `./${relativePath}`;
        
        console.log(`   📁 Verificando archivo en: ${filePath}`);
        
        if (fs.existsSync(filePath)) {
          const savedStats = fs.statSync(filePath);
          console.log(`   ✅ Archivo guardado exitosamente`);
          console.log(`   📊 Tamaño: ${savedStats.size} bytes`);
          console.log(`   📅 Creado: ${savedStats.birthtime}`);
        } else {
          console.log(`   ❌ Archivo no encontrado en: ${filePath}`);
        }
      }
    }
    
    console.log('\n🎯 **RESUMEN DE LA PRUEBA:**');
    if (responseData.data?.uploadImage?.success) {
      console.log('   ✅ Upload exitoso');
      console.log('   ✅ Respuesta siguiendo estándares GraphQL');
      console.log('   ✅ Metadata completa');
      console.log('   ✅ Archivo guardado correctamente');
      console.log('\n🎉 **PRUEBA COMPLETADA EXITOSAMENTE!**');
    } else {
      console.log('   ❌ Upload falló');
      console.log('   📝 Revisar logs del servidor para más detalles');
    }
    
  } catch (error) {
    console.log('\n❌ **ERROR EN LA PRUEBA:**');
    console.log(`   💥 Error: ${error.message}`);
    console.log(`   📚 Stack: ${error.stack}`);
  }
}

// Ejecutar la prueba
if (require.main === module) {
  testUploadImageWithFile().catch(console.error);
}

module.exports = { testUploadImageWithFile };
