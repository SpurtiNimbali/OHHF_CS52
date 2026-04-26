import * as cheerio from 'cheerio'
import fs from 'fs'

const OHHF_RESOURCES_URL = 'https://theohhf.org/resources/#resources'

async function main() {
  console.log(`Fetching: ${OHHF_RESOURCES_URL}`)

  const response = await fetch(OHHF_RESOURCES_URL)

  if (!response.ok) {
    throw new Error(`Failed to fetch page: ${response.status} ${response.statusText}`)
  }

  const html = await response.text()
  const $ = cheerio.load(html)

//   const links = $('a')
//     .map((_, element) => {
//       const title = $(element).text().trim().replace(/\s+/g, ' ')
//       const href = $(element).attr('href')

//       return {
//         title,
//         href,
//       }
//     })
//     .get()
//     .filter((link) => link.title && link.href)

//   console.log(`Found ${links.length} links`)
//   console.log(JSON.stringify(links.slice(0, 30), null, 2))

// Finding headings diagnostic
const resources: {
    section: string
    title: string
    href: string
  }[] = []
  
  let currentSection = ''
  
  $('h1, h2, h3, h4, h5, h6, a').each((_, element) => {
    const tagName = element.tagName.toLowerCase()
    const text = $(element).text().trim().replace(/\s+/g, ' ')
  
    if (!text) return
  
    if (tagName.startsWith('h')) {
      currentSection = text
      return
    }
  
    if (tagName === 'a') {
      const href = $(element).attr('href')
  
      if (!href) return
      if (!currentSection) return
  
      // 🔴 FILTER OUT JUNK
      if (!currentSection.toLowerCase().includes('looking for')) return
      if (href.startsWith('#')) return
      // 🔴 FILTER OUT SITE / FOOTER LINKS
      if (href.includes('theohhf.org')) return
      if (href.startsWith('mailto:')) return
      if (href.includes('facebook.com')) return
      if (href.includes('instagram.com')) return
      if (href.includes('linkedin.com')) return
      if (href.includes('youtube.com')) return

      // 🔴 FILTER GENERIC WORDS
      const badWords = ['privacy', 'policy', 'events', 'news', 'report', 'menu']
      if (badWords.some(word => text.toLowerCase().includes(word))) return
      if (text.toLowerCase().includes('read more')) return
      if (text.length < 3) return
  
      resources.push({
        section: currentSection,
        title: text,
        href,
      })
    }
  })
  
  // 🔴 REMOVE DUPLICATES
  const uniqueResources = Array.from(
    new Map(resources.map((r) => [r.href, r])).values()
  )
  
  console.log(`Filtered down to ${uniqueResources.length} resources`)
  console.log(JSON.stringify(uniqueResources, null, 2))


    fs.writeFileSync(
    'scripts/ohhf_resources.json',
    JSON.stringify(uniqueResources, null, 2)
    )

    console.log('Saved resources to scripts/ohhf_resources.json')
}

main().catch((error) => {
  console.error('Scraper failed:', error)
  process.exit(1)
})