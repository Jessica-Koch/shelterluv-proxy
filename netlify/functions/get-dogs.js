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

    // Keep fetching until has_more is false
    while (hasMore) {
      pageCount++;
      const url = new URL('https://new.shelterluv.com/api/v1/animals');
      url.searchParams.append('limit', limit);
      url.searchParams.append('offset', offset);

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

      // Use the has_more field to determine if we should continue
      hasMore = data.has_more === true;
      
      if (hasMore) {
        offset += limit;
      }
    }

    console.log(`Total animals fetched: ${allAnimals.length}`);

    // Filter for dogs with "Healthy in Home" status
    const adoptedDogs = allAnimals.filter(
      (animal) =>
        (animal.Type === 'Dog' ||
          animal.Species === 'Dog' ||
          animal.species === 'Dog') &&
        animal.Status === 'Healthy in Home'
    );

    console.log(`Adopted dogs (Healthy in Home): ${adoptedDogs.length}`);

    // Let's also see what other statuses exist for dogs
    const allDogs = allAnimals.filter(
      (animal) =>
        animal.Type === 'Dog' ||
        animal.Species === 'Dog' ||
        animal.species === 'Dog'
    );
    
    const statusCounts = {};
    allDogs.forEach(dog => {
      const status = dog.Status || 'No Status';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    console.log('Dog status breakdown:', statusCounts);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        count: adoptedDogs.length,
        total_animals_fetched: allAnimals.length,
        total_dogs: allDogs.length,
        pages_fetched: pageCount,
        status_breakdown: statusCounts,
        dogs: adoptedDogs,
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