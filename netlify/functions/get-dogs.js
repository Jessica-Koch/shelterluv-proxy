const fetch = require('fetch');

exports.handler = async function (event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };
    
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        const apiToken = process.env.SHELTERLUV_API_KEY;

        if (!apiKey) {
            throw new Error('API key not configured');
        }

        const queryParams = event.queryStringParameters || {};
        const limit = queryParams.limit || 100;
        const offset = queryParams.offset || 0;

        const url = new URL('https://new.shelterluv.com/api/v1/animals');
        url.searchParams.append('limit', limit);
        url.searchParams.append('offset', offset);

        const response = await fetch(url.toString(), {
            headers: {
                'Authorization': `Bearer ${apiToken}`
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Shelterluv API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        const dogs = data.animals ? data.animals.filter(animal => 
      animal.Type === 'Dog' || animal.Species === 'Dog' || animal.species === 'Dog'
        ) : [];
         return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        count: dogs.length,
        total_count: data.total_count || null,
        dogs: dogs
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: error.message 
      })
    };
  }
};