const fs = require('fs');

// Read the original HTML
const html = fs.readFileSync('input.html', 'utf-8');

// Find the "View Tax Info" section and inject a Sales section after it
const salesSection = `
<section id="sales" class="accordion-item can-collapse">
  <header class="module-header">
    <div class="title">Sales</div>
  </header>
  <div class="module-content">
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Price</th>
          <th>Instrument</th>
          <th>Inst #</th>
          <th>Book</th>
          <th>Page</th>
          <th>Qual</th>
          <th>V/I</th>
          <th>Grantor</th>
          <th>Grantee</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th>01/15/2020</th>
          <td>$500,000</td>
          <td>WD</td>
          <td>12345</td>
          <td>123</td>
          <td>456</td>
          <td>Q</td>
          <td>I</td>
          <td>SMITH JOHN</td>
          <td>TEST COMPANY LLC</td>
        </tr>
      </tbody>
    </table>
  </div>
</section>
`;

// Find a good place to insert (after "View Tax Info" section)
const modifiedHtml = html.replace(
  /(<section[^>]*View Tax Info[^>]*>.*?<\/section>)/is,
  `$1\n${salesSection}`
);

fs.writeFileSync('input_with_sales.html', modifiedHtml);
console.log('Created input_with_sales.html with sales data');
