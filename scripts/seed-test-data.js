#!/usr/bin/env node

/**
 * Script para generar datos de prueba para el sistema GraphQL
 * Este script crea usuarios, productos, pedidos y otros datos necesarios para probar todas las funcionalidades
 */

require('dotenv').config({ path: require('path').join(__dirname, '../env.development') });

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Datos de prueba
const testUsers = [
  {
    email: 'admin@happybabystyle.com',
    password: 'admin123',
    role: 'admin',
    profile: {
      firstName: 'Admin',
      lastName: 'User',
      phone: '+1234567890',
      isActive: true,
      emailVerified: true
    }
  },
  {
    email: 'customer1@example.com',
    password: 'customer123',
    role: 'customer',
    profile: {
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567891',
      isActive: true,
      emailVerified: true
    }
  },
  {
    email: 'customer2@example.com',
    password: 'customer123',
    role: 'customer',
    profile: {
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '+1234567892',
      isActive: true,
      emailVerified: true
    }
  },
  {
    email: 'staff@happybabystyle.com',
    password: 'staff123',
    role: 'staff',
    profile: {
      firstName: 'Staff',
      lastName: 'Member',
      phone: '+1234567893',
      isActive: true,
      emailVerified: true
    }
  }
];

const testProducts = [
  {
    name: 'Baby Onesie - Organic Cotton',
    description: 'Comfortable and soft organic cotton onesie for babies 0-6 months',
    price: 24.99,
    salePrice: 19.99,
    sku: 'ONESIE-001',
    images: ['https://example.com/onesie1.jpg', 'https://example.com/onesie2.jpg'],
    attributes: {
      size: '0-6M',
      color: 'Blue',
      material: 'Organic Cotton',
      gender: 'Unisex'
    },
    isActive: true,
    stockQuantity: 50,
    tags: ['organic', 'cotton', 'onesie', 'baby']
  },
  {
    name: 'Baby Bib - Waterproof',
    description: 'Waterproof baby bib with cute design, perfect for feeding time',
    price: 12.99,
    salePrice: null,
    sku: 'BIB-001',
    images: ['https://example.com/bib1.jpg'],
    attributes: {
      size: 'Universal',
      color: 'Pink',
      material: 'Waterproof Fabric',
      gender: 'Unisex'
    },
    isActive: true,
    stockQuantity: 75,
    tags: ['bib', 'waterproof', 'feeding', 'baby']
  },
  {
    name: 'Baby Blanket - Soft Fleece',
    description: 'Ultra-soft fleece blanket perfect for swaddling and comfort',
    price: 34.99,
    salePrice: 29.99,
    sku: 'BLANKET-001',
    images: ['https://example.com/blanket1.jpg', 'https://example.com/blanket2.jpg'],
    attributes: {
      size: '30x40 inches',
      color: 'Gray',
      material: 'Fleece',
      gender: 'Unisex'
    },
    isActive: true,
    stockQuantity: 25,
    tags: ['blanket', 'fleece', 'swaddle', 'comfort']
  },
  {
    name: 'Baby Socks - 6 Pack',
    description: 'Comfortable cotton socks for babies, pack of 6 pairs',
    price: 15.99,
    salePrice: 12.99,
    sku: 'SOCKS-001',
    images: ['https://example.com/socks1.jpg'],
    attributes: {
      size: '0-6M',
      color: 'Mixed',
      material: 'Cotton',
      gender: 'Unisex'
    },
    isActive: true,
    stockQuantity: 100,
    tags: ['socks', 'cotton', 'pack', 'baby']
  },
  {
    name: 'Baby Hat - Sun Protection',
    description: 'Sun protection hat with UPF 50+ rating for outdoor activities',
    price: 18.99,
    salePrice: null,
    sku: 'HAT-001',
    images: ['https://example.com/hat1.jpg'],
    attributes: {
      size: '0-12M',
      color: 'White',
      material: 'UPF Fabric',
      gender: 'Unisex'
    },
    isActive: true,
    stockQuantity: 30,
    tags: ['hat', 'sun protection', 'outdoor', 'baby']
  }
];

const testOrders = [
  {
    orderNumber: 'ORD-2024-001',
    status: 'pending',
    subtotal: 49.98,
    taxAmount: 4.99,
    shippingAmount: 5.99,
    discountAmount: 5.00,
    totalAmount: 55.96,
    currency: 'USD',
    notes: 'First order from new customer'
  },
  {
    orderNumber: 'ORD-2024-002',
    status: 'confirmed',
    subtotal: 34.99,
    taxAmount: 3.50,
    shippingAmount: 5.99,
    discountAmount: 0,
    totalAmount: 44.48,
    currency: 'USD',
    notes: 'Regular customer order'
  },
  {
    orderNumber: 'ORD-2024-003',
    status: 'processing',
    subtotal: 67.97,
    taxAmount: 6.80,
    shippingAmount: 0,
    discountAmount: 10.00,
    totalAmount: 64.77,
    currency: 'USD',
    notes: 'Large order with discount'
  },
  {
    orderNumber: 'ORD-2024-004',
    status: 'shipped',
    subtotal: 18.99,
    taxAmount: 1.90,
    shippingAmount: 5.99,
    discountAmount: 0,
    totalAmount: 26.88,
    currency: 'USD',
    notes: 'Single item order'
  },
  {
    orderNumber: 'ORD-2024-005',
    status: 'delivered',
    subtotal: 89.96,
    taxAmount: 9.00,
    shippingAmount: 0,
    discountAmount: 15.00,
    totalAmount: 83.96,
    currency: 'USD',
    notes: 'Completed order'
  }
];

async function seedTestData() {
  console.log('🌱 Starting test data seeding...');

  try {
    // Limpiar datos existentes
    console.log('🧹 Cleaning existing data...');
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.userFavorite.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.product.deleteMany();

    // Crear usuarios
    console.log('👥 Creating test users...');
    const createdUsers = [];
    for (const userData of testUsers) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          password: hashedPassword,
          role: userData.role,
          isActive: true,
          emailVerified: true,
          profile: {
            create: {
              firstName: userData.profile.firstName,
              lastName: userData.profile.lastName,
              phone: userData.profile.phone,
              isActive: userData.profile.isActive,
              emailVerified: userData.profile.emailVerified
            }
          }
        },
        include: {
          profile: true
        }
      });
      createdUsers.push(user);
      console.log(`✅ Created user: ${user.email}`);
    }

    // Crear productos
    console.log('🛍️ Creating test products...');
    const createdProducts = [];
    for (const productData of testProducts) {
      const product = await prisma.product.create({
        data: {
          name: productData.name,
          description: productData.description,
          price: productData.price,
          salePrice: productData.salePrice,
          sku: productData.sku,
          images: productData.images,
          attributes: productData.attributes,
          isActive: productData.isActive,
          stockQuantity: productData.stockQuantity,
          tags: productData.tags,
          reviewCount: Math.floor(Math.random() * 50),
          rating: Math.random() * 5
        }
      });
      createdProducts.push(product);
      console.log(`✅ Created product: ${product.name}`);
    }

    // Crear pedidos
    console.log('📦 Creating test orders...');
    const customerUsers = createdUsers.filter(u => u.role === 'customer');
    
    for (let i = 0; i < testOrders.length; i++) {
      const orderData = testOrders[i];
      const customer = customerUsers[i % customerUsers.length];
      
      const order = await prisma.order.create({
        data: {
          orderNumber: orderData.orderNumber,
          status: orderData.status,
          subtotal: orderData.subtotal,
          taxAmount: orderData.taxAmount,
          shippingAmount: orderData.shippingAmount,
          discountAmount: orderData.discountAmount,
          totalAmount: orderData.totalAmount,
          currency: orderData.currency,
          notes: orderData.notes,
          userId: customer.id
        }
      });

      // Crear items de pedido
      const numItems = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < numItems; j++) {
        const product = createdProducts[Math.floor(Math.random() * createdProducts.length)];
        const quantity = Math.floor(Math.random() * 3) + 1;
        
        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            productId: product.id,
            quantity: quantity,
            unitPrice: product.price,
            totalPrice: product.price * quantity
          }
        });
      }
      
      console.log(`✅ Created order: ${order.orderNumber}`);
    }

    // Crear favoritos
    console.log('❤️ Creating test favorites...');
    for (const customer of customerUsers) {
      const numFavorites = Math.floor(Math.random() * 3) + 1;
      const shuffledProducts = [...createdProducts].sort(() => 0.5 - Math.random());
      
      for (let i = 0; i < numFavorites; i++) {
        await prisma.userFavorite.create({
          data: {
            userId: customer.id,
            productId: shuffledProducts[i].id
          }
        });
      }
      console.log(`✅ Created ${numFavorites} favorites for user: ${customer.email}`);
    }

    console.log('🎉 Test data seeding completed successfully!');
    console.log(`📊 Created ${createdUsers.length} users, ${createdProducts.length} products, ${testOrders.length} orders`);

  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  seedTestData()
    .then(() => {
      console.log('✅ Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedTestData };
