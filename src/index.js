const {
  BaseKonnector,
  requestFactory,
  scrape,
  log,
  utils,
  CookieKonnector
} = require('cozy-konnector-libs')

const { VENDOR_DOWN } = require('cozy-konnector-libs/dist/helpers/errors')
const baseUrl = 'https://proprietaires.artemisiagestion.com/'

class ArtemisiaKonnector extends CookieKonnector
{
  constructor ()
  {
      super()
      this.request = requestFactory({
        // The debug mode shows all the details about HTTP requests and responses. Very useful for
        // debugging but very verbose. This is why it is commented out by default
        // debug: true,
        // Activates [cheerio](https://cheerio.js.org/) parsing on each page
        cheerio: true,
        // If cheerio is activated do not forget to deactivate json parsing (which is activated by
        // default in cozy-konnector-libs
        json: false,
        // This allows request-promise to keep cookies between requests
        jar: true
      })

  }

  testSession() {
    return (this._jar.length > 0)
  }

  async fetch (fields)
  {
    log('info', 'Authenticating ...')
    
    await this.authenticate.bind(this)(fields.login, fields.password)
    log('info', 'Successfully logged in')

    log('info', 'Parsing list of documents')
    const documents = await this.parseDocuments()
  
    // Here we use the saveBills function even if what we fetch are not bills,
    // but this is the most common case in connectors
    log('info', 'Saving data to Cozy')
    await this.saveFiles(documents, fields, {
      timeout: Date.now() + 300 * 1000
    })
    
  }
  async parseDocuments()
  {
    const $ = await this.request(`${baseUrl}/mes-documents`)

    const ListeAnnnees = scrape($,
      {
        annee: {
          sel: 'a span'
        },
        url: {
          sel: 'a',
          attr: 'href'
        }
      },
      'td.ssfa-sortname')
      var ListeDocs = []
      var DocAnnee = []
      // On parcourt les années
      for (const UneAnnee of ListeAnnnees) {

        // On récupère la page de l'année
        const $ = await this.request(UneAnnee.url)
        
        DocAnnee = scrape($, 
          {
            name: {
              sel: 'td:nth-child(2) a span'
            },
            date: {
              sel:'td:nth-child(3)',
              attr: 'data-value',
              parse: str => new Date(str)
            },
            fileurl: {
              sel: 'td:nth-child(2) a',
              attr: 'href'
            }
          },
          'table[data-drawer="drawer1"] tbody tr'
        )

      log('info',"Nombre de documents pour l'année " + UneAnnee.annee + " : " + DocAnnee.length )
      // Ajoute les années
      ListeDocs.push(...DocAnnee)
      
      }
      log('info',"Nombre de documents total : " + ListeDocs.length )
      
      return ListeDocs
  }


  async authenticate(sUser, sPassword)
  {

    var querystring = require('querystring');
    var request = require('request');
    
      var form = {
          log: sUser,
          pwd: sPassword
        };
      
      var formData = querystring.stringify(form);
      var options = {
        uri:`${baseUrl}/wp-login.php`,
        method: 'POST', 
        form: formData
      }

      // Envoie une requête POST sur 
      await this.request (options, function (error, response, body) {
          if( JSON.stringify(response).includes('wordpress_logged_in_'))
            {
              return true;
            }else{
              throw VENDOR_DOWN;
            }
          
      })
  }
}

var oConnecteur = new ArtemisiaKonnector()

oConnecteur.run()
