#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Iniciando seed de la base de datos con Prisma...');

  try {
    // Crear categorías
    console.log('📁 Creando categorías...');
    const categories = await Promise.all([
      prisma.category.create({
        data: {
          name: 'Bodies',
          description: 'Bodies y onesies para bebés',
          slug: 'bodies',
          image: '/images/categories/bodies.jpg',
          isActive: true,
          sortOrder: 1
        }
      }),
      prisma.category.create({
        data: {
          name: 'Pijamas',
          description: 'Pijamas y ropa de dormir',
          slug: 'pijamas',
          image: '/images/categories/pijamas.jpg',
          isActive: true,
          sortOrder: 2
        }
      }),
      prisma.category.create({
        data: {
          name: 'Conjuntos',
          description: 'Conjuntos completos para bebé',
          slug: 'conjuntos',
          image: '/images/categories/conjuntos.jpg',
          isActive: true,
          sortOrder: 3
        }
      })
    ]);

    console.log(`✅ ${categories.length} categorías creadas`);

    // Crear productos
    console.log('👶 Creando productos...');
    const products = await Promise.all([
      prisma.product.create({
        data: {
          categoryId: categories[0].id,
          name: 'Body Algodón Orgánico',
          description: 'Body suave de algodón orgánico 100%, perfecto para la piel delicada del bebé.',
          price: 29.99,
          salePrice: 24.99,
          sku: 'BO-001',
          images: ['/images/products/body-organico-1.jpg', '/images/products/body-organico-2.jpg'],
          attributes: {
            material: 'Algodón orgánico 100%',
            cuidado: 'Lavado a máquina 30°C',
            certificacion: 'GOTS'
          },
          isActive: true,
          stockQuantity: 45,
          tags: ['algodón', 'orgánico', 'suave'],
          rating: 4.5,
          reviewCount: 23
        }
      }),
      prisma.product.create({
        data: {
          categoryId: categories[1].id,
          name: 'Pijama Dreams',
          description: 'Pijama de dos piezas en algodón suave para noches tranquilas.',
          price: 45.99,
          sku: 'PD-002',
          images: ['/images/products/pijama-dreams-1.jpg'],
          attributes: {
            material: 'Algodón 95%, Elastano 5%',
            piezas: '2 piezas',
            temporada: 'Todo el año'
          },
          isActive: true,
          stockQuantity: 23,
          tags: ['pijama', 'algodón', 'cómodo'],
          rating: 4.8,
          reviewCount: 15
        }
      }),
      prisma.product.create({
        data: {
          categoryId: categories[2].id,
          name: 'Conjunto Elegante',
          description: 'Conjunto de tres piezas: body, pantalón y chaqueta ligera.',
          price: 67.99,
          salePrice: 59.99,
          sku: 'CS-003',
          images: ['/images/products/conjunto-elegante-1.jpg', '/images/products/conjunto-elegante-2.jpg'],
          attributes: {
            piezas: '3 piezas',
            ocasion: 'Especial',
            tallas: 'NB-24M'
          },
          isActive: true,
          stockQuantity: 34,
          tags: ['conjunto', 'elegante', 'especial'],
          rating: 4.2,
          reviewCount: 8
        }
      })
    ]);

    console.log(`✅ ${products.length} productos creados`);

    // Crear variantes de productos
    console.log('🔄 Creando variantes...');
    const variants = [];
    
    for (const product of products) {
      const productVariants = await Promise.all([
        prisma.productVariant.create({
          data: {
            productId: product.id,
            name: 'Talla NB',
            price: product.price,
            sku: `${product.sku}-NB`,
            stockQuantity: Math.floor(product.stockQuantity / 3),
            attributes: { talla: 'Recién nacido', peso: '2.5-3.5 kg' },
            isActive: true
          }
        }),
        prisma.productVariant.create({
          data: {
            productId: product.id,
            name: 'Talla 0-3M',
            price: product.price,
            sku: `${product.sku}-0-3M`,
            stockQuantity: Math.floor(product.stockQuantity / 3),
            attributes: { talla: '0-3 meses', peso: '3-6 kg' },
            isActive: true
          }
        }),
        prisma.productVariant.create({
          data: {
            productId: product.id,
            name: 'Talla 3-6M',
            price: product.price,
            sku: `${product.sku}-3-6M`,
            stockQuantity: Math.floor(product.stockQuantity / 3),
            attributes: { talla: '3-6 meses', peso: '6-8 kg' },
            isActive: true
          }
        })
      ]);
      variants.push(...productVariants);
    }

    console.log(`✅ ${variants.length} variantes creadas`);

    // Crear usuarios de prueba
    console.log('👤 Creando usuarios...');
    const users = await Promise.all([
      prisma.userProfile.create({
        data: {
          email: 'admin@happybaby.com',
          firstName: 'Admin',
          lastName: 'Usuario',
          phone: '+51987654321',
          role: 'admin',
          emailVerified: true
        }
      }),
      prisma.userProfile.create({
        data: {
          email: 'maria@example.com',
          firstName: 'María',
          lastName: 'González',
          phone: '+51987654322',
          dateOfBirth: new Date('1990-05-15'),
          role: 'customer',
          emailVerified: true
        }
      }),
      prisma.userProfile.create({
        data: {
          email: 'carlos@example.com',
          firstName: 'Carlos',
          lastName: 'Rodríguez',
          phone: '+51987654323',
          dateOfBirth: new Date('1985-08-22'),
          role: 'customer',
          emailVerified: false
        }
      })
    ]);

    console.log(`✅ ${users.length} usuarios creados`);

    // Crear direcciones para usuarios
    console.log('📍 Creando direcciones...');
    const addresses = await Promise.all([
      prisma.userAddress.create({
        data: {
          userId: users[1].id, // María
          type: 'shipping',
          firstName: 'María',
          lastName: 'González',
          address1: 'Av. Primavera 123',
          address2: 'Dpto. 4B',
          city: 'Lima',
          state: 'Lima',
          postalCode: '15001',
          country: 'PE',
          phone: '+51987654322',
          isDefault: true
        }
      }),
      prisma.userAddress.create({
        data: {
          userId: users[2].id, // Carlos
          type: 'shipping',
          firstName: 'Carlos',
          lastName: 'Rodríguez',
          address1: 'Jr. Las Flores 456',
          city: 'Lima',
          state: 'Lima',
          postalCode: '15002',
          country: 'PE',
          phone: '+51987654323',
          isDefault: true
        }
      })
    ]);

    console.log(`✅ ${addresses.length} direcciones creadas`);

    // Crear órdenes de prueba
    console.log('📦 Creando órdenes...');
    const orders = await Promise.all([
      prisma.order.create({
        data: {
          userId: users[1].id,
          orderNumber: 'ORD-001',
          status: 'delivered',
          subtotal: 75.98,
          taxAmount: 13.68,
          shippingAmount: 10.00,
          totalAmount: 99.66,
          currency: 'PEN',
          shippingAddressId: addresses[0].id,
          notes: 'Entregar en horario de oficina'
        }
      }),
      prisma.order.create({
        data: {
          userId: users[2].id,
          orderNumber: 'ORD-002',
          status: 'processing',
          subtotal: 45.99,
          taxAmount: 8.28,
          shippingAmount: 10.00,
          totalAmount: 64.27,
          currency: 'PEN',
          shippingAddressId: addresses[1].id
        }
      })
    ]);

    console.log(`✅ ${orders.length} órdenes creadas`);

    // Crear items de órdenes
    console.log('🛍️ Creando items de órdenes...');
    const orderItems = await Promise.all([
      // Orden 1 - María
      prisma.orderItem.create({
        data: {
          orderId: orders[0].id,
          productId: products[0].id,
          quantity: 2,
          unitPrice: 24.99, // Precio con descuento
          totalPrice: 49.98
        }
      }),
      prisma.orderItem.create({
        data: {
          orderId: orders[0].id,
          productId: products[2].id,
          quantity: 1,
          unitPrice: 59.99, // Precio con descuento
          totalPrice: 59.99
        }
      }),
      // Orden 2 - Carlos
      prisma.orderItem.create({
        data: {
          orderId: orders[1].id,
          productId: products[1].id,
          quantity: 1,
          unitPrice: 45.99,
          totalPrice: 45.99
        }
      })
    ]);

    console.log(`✅ ${orderItems.length} items de órdenes creados`);

    // Crear favoritos
    console.log('❤️ Creando favoritos...');
    const favorites = await Promise.all([
      prisma.userFavorite.create({
        data: {
          userId: users[1].id,
          productId: products[0].id
        }
      }),
      prisma.userFavorite.create({
        data: {
          userId: users[1].id,
          productId: products[1].id
        }
      }),
      prisma.userFavorite.create({
        data: {
          userId: users[2].id,
          productId: products[2].id
        }
      })
    ]);

    console.log(`✅ ${favorites.length} favoritos creados`);

    console.log('\n🎉 ¡Seed completado exitosamente!');
    console.log('\n📊 Resumen:');
    console.log(`   ${categories.length} categorías`);
    console.log(`   ${products.length} productos`);
    console.log(`   ${variants.length} variantes`);
    console.log(`   ${users.length} usuarios`);
    console.log(`   ${addresses.length} direcciones`);
    console.log(`   ${orders.length} órdenes`);
    console.log(`   ${orderItems.length} items de órdenes`);
    console.log(`   ${favorites.length} favoritos`);

  } catch (error) {
    console.error('❌ Error durante el seed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar seed si es llamado directamente
if (require.main === module) {
  seed()
    .then(() => {
      console.log('✅ Script de seed ejecutado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error en el script de seed:', error);
      process.exit(1);
    });
}

export { seed };