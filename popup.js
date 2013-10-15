/* Covered Call Calculator
 * @author: Luke Jeter
 * @license: GPL v.
 */

var covered_call_calc = {
  // constants
  SEC_FEE: .003,
  
  // attributes
  calc_fees: false,
  stock_price: 0,
  strike_price: 0,
  premium: 0,
  contracts: 1,
  option_commission: 0,
  assigned_commission: 0,
  expiration: new Date(),

  // methods - only one instance of this class should exists, negating any benefit of using object.prototype for functions
  initialize: function() {
    this.restore_storage();
    
    this._set_expiration();
    if (this.expiration < Date.now()){
      if (this.expiration.getMonth() == 12)
        this.expiration.setYear(this.expiration.getFullYear()+1);
      this.expiration.setMonth((this.expiration.getMonth()+1)%12);
      this.expiration.setDate(1);
      this._set_expiration();
    }
    this._populate_months();

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
        $.ajax({
          url: 'http://dev.markitondemand.com/Api/Quote/json?symbol=' + this.value,
          dataType: 'json',
          success: function(response) {
            var _price = '';
            if (response.Data != undefined)
              _price = response.Data.LastPrice;
            else {
              console.log('Error looking up quote: ' + response.Message);
              $(this).addClass('neg');
            }
            $('input[name="stock_price"]').val(_price);
          },
          fail: function(response) {
            console.log('Error looking up quote.');
          },
        });
        this.value = this.value.toUpperCase();
      }
    });

    $('input[name="calc_fees"').bind('change', function(event) {
      console.debug('change event: this.checked='+this.checked); 
      //TODO: set a breakpoint on the next line and see the value of "this.checked" be different above and below
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
    }).trigger('change'); 
    //TODO: this trigger occurs before the checked state gets set... and we thought javascript was single threaded!

    $('button#save_settings').bind('click', function() {
      covered_call_calc.save_settings();
    });

    
    $('select').bind('change', function(event) {
      var expire_string = $(this).find('option:selected').text();
      covered_call_calc._set_expiration(expire_string);
      covered_call_calc.calculate();
      return false;
    });
    
    //TODO: determine why i can't assign these in the <input[type="button"] onclick
    $('input[type="button"]').bind('click', function(event) {
      switch (this.value) {
        case 'Calculate':
          covered_call_calc.calculate();
          break;
        case 'Add to List':
          covered_call_calc.add_to_list();
        default:
          alert('i don\'t work yet');
      }
    });
  }, /* end of initialize() */
 
  _set_expiration: function(_date) {
    if (typeof _date != 'undefined')
      this.expiration = new Date(_date); //can't believe the ECMAscript spec requires that a sting like this get properly plarsed!
    var month = this.expiration.getMonth();
    var year = this.expiration.getFullYear();
    this.expiration.setDate(16 + (12 - new Date(year, month, 1).getDay()) % 7);
  },
  _populate_months: function() {
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
  add_to_list: function() {
    $('table.expirations').add($('tr').add($(td).add(this.symbol)
                                                .add(this.stock_price)
                                                .add(this.strike_price)
                                                .add(this.expiration.toLocaleDateString())
                                              ));
    this.save_list();
  },
  calculate_fees: function() {
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
    this.calculate_fees();
    var call_income = this.get_call_income();
    var total_income = this.get_total_income();
    
    $('div#results span').removeClass();
    $('span#call_income').text('$' + call_income[0]).addClass(call_income[0]<0?'neg':'pos');
    $('span#call_annualized').text(call_income[1] + '%').addClass(call_income[1]<0?'neg':'pos');
    $('span#total_income').text('$' + total_income[0]).addClass(total_income[0]<0?'neg':'pos');
    $('span#total_annualized').text(total_income[1] + '%').addClass(total_income[1]<0?'neg':'pos');
  },
  get_call_income: function(_expire) {
    var income = this.premium * this.contracts * 100;
    income -= this.option_commission;
    var annualized_return = this._get_annualized_return(income);
    return [this.round(income), annualized_return];
  },
  get_total_income: function(_expire) {
    var income = (this.premium + this.strike_price - this.stock_price) * this.contracts * 100;
    income -= this.option_commission + this.assigned_commission;
    var annualized = this._get_annualized_return(income);
    return [this.round(income), annualized];
  },
  _get_annualized_return: function(_income) {
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
  restore_storage: function() {
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
        covered_call_calc.calc_fees = state.settings.calc_fees;
      }
      if (state.expirations != undefined)
        $('table.expirations tbody').html(state.expirations);
    });
  },
  save_settings: function(event) {
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
  },
  
  save_list: function() {
    chrome.storage.sync.set({expirations:$('table#expirations tbody').html()});
  },

};


$(document).ready(function() {  
  covered_call_calc.initialize();
});