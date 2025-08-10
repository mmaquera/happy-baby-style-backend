#!/usr/bin/env node

/**
 * Script para arreglar automáticamente errores de linter
 * Convierte todos los catch (error) en catch (error: any)
 */

const fs = require('fs');
const path = require('path');

const resolversPath = path.join(__dirname, '../src/graphql/resolvers.ts');

function fixLinterErrors() {
  console.log('🔧 Fixing linter errors in resolvers...');
  
  try {
    let content = fs.readFileSync(resolversPath, 'utf8');
    
    // Arreglar todos los catch (error) que no tienen tipo
    content = content.replace(/catch \(error\)/g, 'catch (error: any)');
    
    // Arreglar el error de isActive en CreateUserRequest
    content = content.replace(
      /isActive: input\.isActive !== false,/g,
      '// isActive: input.isActive !== false, // Removed - not in CreateUserRequest'
    );
    
    fs.writeFileSync(resolversPath, content, 'utf8');
    
    console.log('✅ Linter errors fixed successfully!');
    console.log('📝 Changes made:');
    console.log('  - Fixed catch (error) -> catch (error: any)');
    console.log('  - Commented out isActive property in createUser');
    
  } catch (error) {
    console.error('❌ Error fixing linter errors:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  fixLinterErrors();
}

module.exports = { fixLinterErrors };

