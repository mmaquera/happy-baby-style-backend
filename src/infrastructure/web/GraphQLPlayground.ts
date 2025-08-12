/**
 * GraphQL Playground Infrastructure Component
 * Provides a development interface for GraphQL API exploration
 * Following Clean Architecture principles: Infrastructure Layer
 */

export interface PlaygroundConfig {
  title: string;
  endpoint: string;
  port: number;
}

export class GraphQLPlayground {
  private static readonly DEFAULT_QUERIES = [
    {
      id: 'health',
      title: '🔍 Health Check',
      description: 'Basic server health verification',
      query: '{ health }'
    },
    {
      id: 'categories',
      title: '📂 Categories',
      description: 'Retrieve product categories with pagination',
      query: `{ 
        categories(filters: { isActive: true }, pagination: { limit: 10, offset: 0 }) { 
          success 
          message 
          code 
          timestamp 
          data { 
            items { 
              id 
              name 
              slug 
              isActive 
              sortOrder 
              description 
            } 
            pagination { 
              total 
              limit 
              offset 
              hasMore 
              currentPage 
              totalPages 
            } 
          } 
          metadata { 
            requestId 
            traceId 
            duration 
          } 
        } 
      }`
    },
    {
      id: 'categoryById',
      title: '🔍 Category by ID',
      description: 'Get a specific category by ID',
      query: `{ 
        category(id: "category-id-here") { 
          success 
          message 
          code 
          timestamp 
          data { 
            entity { 
              id 
              name 
              slug 
              isActive 
              sortOrder 
              description 
              image 
              createdAt 
              updatedAt 
            } 
          } 
          metadata { 
            requestId 
            traceId 
            duration 
          } 
        } 
      }`
    },
    {
      id: 'categoryBySlug',
      title: '🔍 Category by Slug',
      description: 'Get a specific category by slug',
      query: `{ 
        categoryBySlug(slug: "baby-clothing") { 
          success 
          message 
          code 
          timestamp 
          data { 
            entity { 
              id 
              name 
              slug 
              isActive 
              sortOrder 
              description 
              image 
              createdAt 
              updatedAt 
            } 
          } 
          metadata { 
            requestId 
            traceId 
            duration 
          } 
        } 
      }`
    },
    {
      id: 'products',
      title: '📦 Products',
      description: 'Get products with pagination',
      query: '{ products { products { id name price stockQuantity isActive } total hasMore } }'
    },
    {
      id: 'statistics',
      title: '📊 Statistics',
      description: 'System analytics and metrics',
      query: '{ productStats orderStats userStats }'
    },
    {
      id: 'users',
      title: '👥 Users',
      description: 'User management data',
      query: '{ users { users { id firstName lastName } total } }'
    },
    {
      id: 'orders',
      title: '🛒 Orders',
      description: 'Order management data',
      query: '{ orders { orders { id orderNumber status totalAmount } total } }'
    },
    {
      id: 'createCategory',
      title: '➕ Create Category',
      description: 'Create a new product category',
      query: 'mutation { createCategory(input: { name: "Test Category" slug: "test-category" isActive: true sortOrder: 1 }) { success message code data { entity { id name slug } id createdAt } metadata { requestId traceId duration } } }'
    },
    {
      id: 'updateCategory',
      title: '✏️ Update Category',
      description: 'Update an existing product category',
      query: 'mutation { updateCategory(id: "category-id", input: { name: "Updated Category" description: "Updated description" isActive: false }) { success message code data { entity { id name description isActive } id updatedAt changes } metadata { requestId traceId duration } } }'
    },
    {
      id: 'deleteCategory',
      title: '🗑️ Delete Category',
      description: 'Delete a product category (soft delete by default)',
      query: 'mutation { deleteCategory(id: "category-id") { success message code data { id deletedAt softDelete } metadata { requestId traceId duration } } }'
    }
  ];

  /**
   * Generates the complete HTML interface for the GraphQL Playground
   */
  public static generateInterface(config: PlaygroundConfig): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${config.title}</title>
        ${this.generateStyles()}
      </head>
      <body>
        <div class="container">
          ${this.generateHeader(config)}
          <div class="grid">
            ${this.generateSidebar()}
            ${this.generateMainEditor()}
          </div>
        </div>
        ${this.generateScript()}
      </body>
      </html>
    `;
  }

  private static generateStyles(): string {
    return `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #f5f7fa;
          padding: 20px;
          line-height: 1.6;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { 
          background: #667eea; 
          color: white; 
          padding: 20px; 
          border-radius: 10px;
          margin-bottom: 20px;
          text-align: center;
        }
        .grid { display: grid; grid-template-columns: 300px 1fr; gap: 20px; }
        .sidebar, .main { 
          background: white; 
          padding: 20px; 
          border-radius: 10px; 
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .example { 
          background: #f8f9fa; 
          border: 1px solid #dee2e6;
          border-radius: 5px; 
          padding: 15px; 
          margin: 10px 0; 
          cursor: pointer;
          transition: all 0.2s;
        }
        .example:hover { background: #e9ecef; transform: translateY(-1px); }
        .example h4 { color: #495057; margin-bottom: 8px; }
        .example pre { 
          background: #343a40; 
          color: #f8f9fa; 
          padding: 8px; 
          border-radius: 3px; 
          font-size: 12px;
          overflow-x: auto;
        }
        textarea { 
          width: 100%; 
          height: 300px; 
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 14px;
          border: 1px solid #ddd;
          border-radius: 5px;
          padding: 15px;
          resize: vertical;
        }
        .btn {
          background: #667eea;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 16px;
          margin: 10px 5px 10px 0;
        }
        .btn:hover { background: #5a6fd8; }
        .results {
          background: #f8f9fa;
          border: 1px solid #ddd;
          border-radius: 5px;
          padding: 15px;
          margin-top: 15px;
          min-height: 200px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 13px;
          white-space: pre-wrap;
          overflow-x: auto;
        }
        .status { padding: 8px 12px; border-radius: 4px; margin: 8px 0; }
        .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
        .endpoint { 
          background: #e2e3e5; 
          padding: 10px; 
          border-radius: 5px; 
          font-family: monospace; 
          margin: 10px 0;
        }
        @media (max-width: 768px) {
          .grid { grid-template-columns: 1fr; }
          .sidebar { order: 2; }
        }
      </style>
    `;
  }

  private static generateHeader(config: PlaygroundConfig): string {
    return `
      <div class="header">
        <h1>🚀 GraphQL Playground</h1>
        <p>Happy Baby Style - API Development Interface</p>
        <div class="endpoint">Endpoint: http://localhost:${config.port}/graphql</div>
      </div>
    `;
  }

  private static generateSidebar(): string {
    const examplesHtml = this.DEFAULT_QUERIES.map(query => `
      <div class="example" data-query="${this.escapeHtml(query.query)}">
        <h4>${query.title}</h4>
        <p style="font-size: 12px; color: #6c757d; margin-bottom: 8px;">${query.description}</p>
        <pre>${this.truncateQuery(query.query)}</pre>
      </div>
    `).join('');

    return `
      <div class="sidebar">
        <h3>📋 Example Queries</h3>
        ${examplesHtml}
      </div>
    `;
  }

  private static generateMainEditor(): string {
    return `
      <div class="main">
        <h3>Query Editor</h3>
        <textarea id="queryInput" placeholder="Enter your GraphQL query here...">{ health }</textarea>
        
        <div>
          <button id="executeBtn" class="btn">▶ Execute Query</button>
          <button id="clearBtn" class="btn" style="background: #6c757d;">🗑 Clear</button>
          <button id="formatBtn" class="btn" style="background: #28a745;">✨ Format</button>
        </div>
        
        <h3>Results</h3>
        <div id="results" class="results">
          <div class="status info">Ready to execute queries! Click on examples or write your own.</div>
        </div>
      </div>
    `;
  }

  private static generateScript(): string {
    return `
      <script>
        document.addEventListener('DOMContentLoaded', function() {
          const queryInput = document.getElementById('queryInput');
          const resultsDiv = document.getElementById('results');
          const executeBtn = document.getElementById('executeBtn');
          const clearBtn = document.getElementById('clearBtn');
          const formatBtn = document.getElementById('formatBtn');
          const examples = document.querySelectorAll('.example');
          
          function loadQuery(query) {
            queryInput.value = query;
          }
          
          function clearQuery() {
            queryInput.value = '';
            resultsDiv.innerHTML = '<div class="status info">Query cleared. Ready for new input.</div>';
          }
          
          function formatQuery() {
            const query = queryInput.value.trim();
            if (query) {
              const formatted = query
                .replace(/\\{/g, ' {\\n  ')
                .replace(/\\}/g, '\\n}')
                .replace(/\\s+/g, ' ')
                .trim();
              queryInput.value = formatted;
            }
          }
          
          async function executeQuery() {
            const query = queryInput.value.trim();
            
            if (!query) {
              resultsDiv.innerHTML = '<div class="status error">Please enter a query</div>';
              return;
            }
            
            resultsDiv.innerHTML = '<div class="status info">Executing query...</div>';
            
            try {
              const response = await fetch('/graphql', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query })
              });
              
              const result = await response.json();
              
              if (result.errors) {
                resultsDiv.innerHTML = 
                  '<div class="status error">❌ Errors found:</div>' +
                  JSON.stringify(result.errors, null, 2);
              } else {
                resultsDiv.innerHTML = 
                  '<div class="status success">✅ Query executed successfully!</div>' +
                  JSON.stringify(result.data, null, 2);
              }
            } catch (error) {
              resultsDiv.innerHTML = 
                '<div class="status error">❌ Network error:</div>' +
                error.message;
            }
          }
          
          // Event listeners
          executeBtn.addEventListener('click', executeQuery);
          clearBtn.addEventListener('click', clearQuery);
          formatBtn.addEventListener('click', formatQuery);
          
          examples.forEach(function(example) {
            example.addEventListener('click', function() {
              const query = this.getAttribute('data-query');
              loadQuery(query);
            });
          });
          
          queryInput.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'Enter') {
              executeQuery();
            }
          });
        });
      </script>
    `;
  }

  private static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private static truncateQuery(query: string): string {
    if (query.length > 60) {
      return query.substring(0, 57) + '...';
    }
    return query;
  }
}