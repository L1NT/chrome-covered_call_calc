/* Covered Call Calculator
 * @author: Luke Jeter
 * @license: GPL v.
 */

var covered_call_calc = {
  // constants
  SEC_FEE: .0001288,
  
  // attributes
  expirations_table: null,
  
  calc_fees: false,
  symbol: '',
  stock_price: 0,
  strike_price: 0,
  premium: 0,
  contracts: 1,
  option_commission: 0,
  assigned_commission: 0,
  expiration: new Date(),

  // methods - only one instance of this "class" should exists, negating any benefit of using object.prototype for functions
  initialize: function() {
    this.restoreStorage();
    
    this._setExpiration();
    var _expiration = this.expiration;
    if (_expiration < Date.now()){
      if (_expiration.getMonth() == 12)
        _expiration.setYear(_expiration.getFullYear()+1);
      _expiration.setMonth((_expiration.getMonth()+1)%12);
      _expiration.setDate(1);
      this._setExpiration();
    }
    this._populateMonths();

    $('nav li').bind('click', function(event) {
      var jqTarget = $(event.currentTarget);
      jqTarget.removeClass('inactive');
      jqTarget.siblings('li').addClass('inactive');
      $('.tab').each(function() {
        if ($(this).hasClass(jqTarget.attr('id')))
          $(this).show();
        else
          $(this).hide();
      });
    });
    $('li#calc').trigger('click');
            
    $('section.calc input').bind('change', function(event) {
      var jq_input = $(event.currentTarget);
      var value = parseFloat(jq_input.val());
      covered_call_calc[jq_input.attr('name')] = value;
      jq_input.val(covered_call_calc.round(value));
      covered_call_calc.calculate();
      return false;
    });
    
    $('input.ticker').unbind('change').bind('change', function(){
      $(this).removeClass('neg');
      if (this.value != '') {
        covered_call_calc.lookupQuote(this.value, function(_quote) {
          var price = '';
          if (_quote.Data != undefined)
            price = _quote.Data.LastPrice;
          else {
            console.log('Error looking up quote: ' + _quote.Message);
          }
          if (price != '') {
            $('input[name="stock_price"]').val(price);
            covered_call_calc.stock_price = parseFloat(price);
          }
          else
            $('input.ticker').addClass('neg');
        });
        this.value = this.value.toUpperCase();
      }
      covered_call_calc.symbol = this.value;
    });

    $('input[name="calc_fees"').bind('change', function(event) {
      if (this.checked) {
        $('form[name="settings"] input').removeAttr('disabled');
        $('section.calc.tab input.commissions').attr('disabled', 'disabled');
        covered_call_calc.calc_fees = true;
      }
      else {
        $('form[name="settings"] input').attr('disabled', 'disabled');
        $('section.calc.tab input.commissions').removeAttr('disabled');
        covered_call_calc.calc_fees = false;
      }
      covered_call_calc.calculate();
    });

    $('button#save_settings').bind('click', function() {
      covered_call_calc.saveSettings();
    });

    
    $('select').bind('change', function(event) {
      var expire_string = $(this).find('option:selected').text();
      covered_call_calc._setExpiration(expire_string);
      covered_call_calc.calculate();
      return false;
    });
    
    $('input[type="button"]').bind('click', function(event) {
      switch (this.value) {
        case 'Calculate':
          covered_call_calc.calculate();
          break;
        case 'Add to List':
          covered_call_calc.addToList();
          break;
        default:
          $('div#notifications').text('i don\'t work yet').fadeIn(400).delay(2000).fadeOut(400);
      }
    });
    $('table#expirations a.delete').live('click', function(){
      covered_call_calc.expirations_table.fnDeleteRow($(this).closest('tr')[0]);
      covered_call_calc.saveList();
    });
  }, /* end of initialize() */
 
  _setExpiration: function(_date) {
    if (typeof _date != 'undefined')
      this.expiration = new Date(_date); //can't believe the ECMAscript spec requires that a sting like this get properly plarsed!
    var month = this.expiration.getMonth();
    var year = this.expiration.getFullYear();
    this.expiration.setDate(16 + (12 - new Date(year, month, 1).getDay()) % 7);
  },
  _populateMonths: function() {
    var date = this.expiration;
    var month = date.getMonth();
    var year = date.getFullYear();
    var month_options = '';
    for (var max=month+24; month<max; month++) {
      if (month%12 == 0) year++;
      month_options += '<option>' + this._toMonthStr(month%12) + ', ' + year + '</option>';
    }
    $('select[name="call_date"]').html(month_options);
  },
  _toMonthStr: function(_num) {
    switch (_num) {
      case 0: return 'January';
      case 1: return 'February';
      case 2: return 'March';
      case 3: return 'April';
      case 4: return 'May';
      case 5: return 'June';
      case 6: return 'July';
      case 7: return 'August';
      case 8: return 'September';
      case 9: return 'October';
      case 10: return 'November';
      case 11: return 'December';
    }
  },
  /*
   * Is there any way to explicitly indicate that _callback is passed a _price parameter?
   */
  lookupQuote: function(_symbol, _callback) {
    if (_symbol) {
      $.ajax({
        url: 'http://dev.markitondemand.com/Api/Quote/json?symbol=' + _symbol,
        dataType: 'json',
        success: function(_response) {
          _callback(_response);
        },
        fail: function(response) {
          console.log('Error looking up quote.');
        },
      });
    }
  },
  addToList: function() {
    this.expirations_table.fnAddData([this.symbol,
                                      this.round(this.stock_price),
                                      this.round(this.stock_price),
                                      this.round(this.strike_price),
                                      this.expiration.toLocaleDateString(),
                                      '<a class="delete" href="#">delete</a>']);
    
    $('div#notifications').text('call option saved to expirations list').fadeIn(400).delay(2000).fadeOut(400);;       
    this.saveList();
  },
  refreshExpireList: function() {
    $('table#expirations td.date').removeClass('neg').each(function() {
      if (new Date($(this).text()) < Date.now())
        $(this).addClass('neg');
    });
    $('table#expirations td.symbol').each(function() {
      covered_call_calc.lookupQuote($(this).text(), function(_quote) {
        if (_quote.Data != undefined) {
          $('table#expirations td.symbol:contains('+_quote.Data.Symbol+')').each(function() {
            $(this).siblings('td.stock').text(_quote.Data.LastPrice);
          });
        }
      });
    });
  },
  calculateFees: function() {
    if (this.calc_fees) {
      var trans = parseFloat($('input[name="option_transaction"]').val()) || 0;
      var per_share =  parseFloat($('input[name="option_per_contract"]').val()) || 0;
      this.option_commission = trans + per_share * this.contracts;
      if ($('input[name="option_sec_fee"]')[0].checked)
        this.option_commission += this.SEC_FEE * this.premium * this.contracts * 100;
      $('input[name="option_commission"]').val(this.round(this.option_commission));
      
      trans = parseFloat($('input[name="assigned_transaction"]').val()) || 0;
      per_share = parseFloat($('input[name="assigned_per_share"]').val()) || 0;
      this.assigned_commission = trans + per_share * this.contracts;
      if ($('input[name="stock_sec_fee"]')[0].checked)
        this.assigned_commission += this.SEC_FEE * this.strike_price * this.contracts * 100;
      $('input[name="assigned_commission"]').val(this.round(this.assigned_commission));
    }
  },
  calculate: function() {
    this.calculateFees();
    var call_income = this.getCallIncome();
    var total_income = this.getTotalIncome();
    
    $('div#results span').removeClass();
    $('span#call_income').text('$' + call_income[0]).addClass(call_income[0]<0?'neg':'pos');
    $('span#call_annualized').text(call_income[1] + '%').addClass(call_income[1]<0?'neg':'pos');
    $('span#total_income').text('$' + total_income[0]).addClass(total_income[0]<0?'neg':'pos');
    $('span#total_annualized').text(total_income[1] + '%').addClass(total_income[1]<0?'neg':'pos');
  },
  getCallIncome: function(_expire) {
    var income = this.premium * this.contracts * 100;
    income -= this.option_commission;
    var annualized_return = this._getAnnualizedReturn(income);
    return [this.round(income), annualized_return];
  },
  getTotalIncome: function(_expire) {
    var income = (this.premium + this.strike_price - this.stock_price) * this.contracts * 100;
    income -= this.option_commission + this.assigned_commission;
    var annualized = this._getAnnualizedReturn(income);
    return [this.round(income), annualized];
  },
  _getAnnualizedReturn: function(_income) {
    if (this.stock_price == 0 || this.contracts == 0)
      return 0;
    var annualized_return = _income/(this.stock_price * this.contracts * 100);
    var days_to_expire = (this.expiration - Date.now())/ 24 / 60 / 60 / 1000;
    annualized_return = annualized_return * (365/days_to_expire) * 100;
    return this.round(annualized_return);
  },
  round: function(_d) {
    if (isNaN(_d))
      return;
    var negative = false;
    if (_d < 0) {
        negative = true;
        _d *= -1;
    }
    var a, b;
    _d += .005;
    a = parseInt(_d);
    _d = (_d - a) * 100;
    b = parseInt(_d);
    if (negative) {
      if (b < 10)
        return "-" + a + ".0" + b;
      else
        return "-" + a + "." + b;
    } else {
      if (b < 10)
        return a + ".0" + b;
      else
        return a + "." + b;
    }
  },
  restoreStorage: function() {
    var ccc = covered_call_calc;
    chrome.storage.sync.get(function(state) {
      if (state.settings != undefined) {
        $('section.settings input').each(function() {
          switch (this.type) {
            case 'button':
              break;
            case 'checkbox':
              this.checked = state.settings[this.name];
              break;
            default:
              this.value = state.settings[this.name] || null; 
          }
        });
        ccc.calc_fees = state.settings.calc_fees;
      }
      if (state.expirations != undefined)
        ccc.expirations_table.fnAddData(state.expirations);
    });
  },
  saveSettings: function(event) {
    var settings = {};
    $('section.settings input').each(function(){
      switch (this.type) {
        case 'button':
          break;
        case 'checkbox':
          settings[this.name] = this.checked;
          break;
        default:
          settings[this.name] = this.value;
      }        
    });
    chrome.storage.sync.set({settings:settings});
    this.calculate();
    $('div#notifications').text('settings have been saved').fadeIn(400).delay(2000).fadeOut(400);;
  },
  
  saveList: function() {
    var data = this.expirations_table.fnGetData();
    if (data.length != 0)
      chrome.storage.sync.set({expirations: data});
  },

};


$(document).ready(function() {
  var ccc = covered_call_calc;
  ccc.expirations_table = $('table#expirations').dataTable({
      "bSort": true,
      "aaSorting": [[4,'asc'],[0,'asc']],
      "bStateSave": true,
      "aoColumns": [
        { "sClass": "symbol" },
        { "sClass": "orig" },
        { "sClass": "stock" },
        { "sClass": "strike" },
        { "sClass": "date" },
        { "sClass": null }],
    });
  ccc.initialize();
  //TODO: this is a fucking lame fix, and could easily break on a slow machine or with a large amount of storage:
  // when in doubt, set a timeout!!
  setTimeout(function() {
    // this trigger was originally placed in-line at the initialize() function's bind method occurs before the checked state gets set... and we thought javascript was single threaded!
    $('input[name="calc_fees"').trigger('change'); 
    ccc.refreshExpireList();
  }, '500');
});
