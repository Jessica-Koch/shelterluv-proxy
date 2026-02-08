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
      body: '',
    };
  }

  try {
    const apiKey = process.env.SHELTERLUV_API_KEY;

    if (!apiKey) {
      throw new Error('API key not configured');
    }

    let allAnimals = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    let pageCount = 0;

    while (hasMore) {
      pageCount++;
      const url = new URL('https://new.shelterluv.com/api/v1/animals');
      url.searchParams.append('limit', limit);
      url.searchParams.append('offset', offset);
      url.searchParams.append('status_type', 'publishable'); // Add publishable filter

      console.log(`Fetching page ${pageCount}, offset ${offset}`);

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Shelterluv API error: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      console.log(`Page ${pageCount} returned ${data.animals ? data.animals.length : 0} animals`);
      console.log(`has_more: ${data.has_more}, total_count: ${data.total_count}`);

      if (data.animals && data.animals.length > 0) {
        allAnimals = allAnimals.concat(data.animals);
      }

      hasMore = data.has_more === true;
      
      if (hasMore) {
        offset += limit;
      }
    }

    console.log(`Total animals fetched: ${allAnimals.length}`);

    // Filter for dogs available for adoption:
    // - Must be a dog
    // - Status_type already filtered to "publishable" by API
    // - InFoster indicates if they need a foster (true = in foster, false = needs foster)
    const availableDogs = allAnimals.filter(
      (animal) => {
        const isDog = animal.Type === 'Dog' || 
                      animal.Species === 'Dog' || 
                      animal.species === 'Dog';
        
        return isDog;
      }
    );

    // Add foster status to each dog for easy frontend filtering
    const dogsWithFosterStatus = availableDogs.map(dog => ({
      ...dog,
      needsFoster: !dog.InFoster // If not in foster, they need one
    }));

    console.log(`Available dogs for adoption: ${availableDogs.length}`);
    console.log(`Dogs needing foster: ${dogsWithFosterStatus.filter(d => d.needsFoster).length}`);
    console.log(`Dogs currently in foster: ${dogsWithFosterStatus.filter(d => !d.needsFoster).length}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        count: availableDogs.length,
        total_animals_fetched: allAnimals.length,
        pages_fetched: pageCount,
        dogs: dogsWithFosterStatus,
        stats: {
          total: availableDogs.length,
          needsFoster: dogsWithFosterStatus.filter(d => d.needsFoster).length,
          inFoster: dogsWithFosterStatus.filter(d => !d.needsFoster).length
        }
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
};