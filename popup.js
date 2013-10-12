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
    // load static options (i.e. transaction fee calculations and )
    
    this._set_expiration();
    if (this.expiration < Date.now()){
      if (this.expiration.getMonth() == 12)
        this.expiration.setYear(this.expiration.getFullYear()+1);
      this.expiration.setMonth((this.expiration.getMonth()+1)%12);
      this.expiration.setDate(1);
      this._set_expiration();
    }
    this._populate_months();
    
    if (this.calc_fees) {
      $('input.commissions').attr('readonly', 'readonly');
    }

    $('li').bind('click', function(event) {
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
        
    $('input').bind('change', function(event) {
      var jq_input = $(event.currentTarget);
      var value = parseFloat(jq_input.val());
      covered_call_calc[jq_input.attr('name')] = value;
      jq_input.val(covered_call_calc.round(value));
      covered_call_calc.calculate();
      return false;
    });
    
    $('select').bind('change', function(event) {
      var expire_string = $(this).find('option:selected').text();
      covered_call_calc._set_expiration(expire_string);
      covered_call_calc.calculate();
      return false;
    });
    
    //TODO: determine why i can't assign these in the <input[type="button"] onclick
    $('input[type="button"]').bind('click', function(event) {
      switch ($(this).val()) {
        case 'Calculate':
          covered_call_calc.calculate();
          break;
        default:
          alert('i don\'t work yet');
      }
    });
    
    //TODO: set the states of the settings first!!
    $('input#calc_fees').bind('change', function(event) {
      if (this.checked) {
        $('form[name="settings"] input').removeAttr('disabled');
        covered_call_calc.calc_fees = true;
      }
      else {
        $('form[name="settings"] input').attr('disabled', 'disabled');
        covered_call_calc.calc_fees = false;
      }
    }).trigger('change');

    $(window).bind('onbeforeunload', function() {
      this.save_state();
    });
  },
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
  
  calculate_fees: function() {},
  calculate: function() {    
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
  save_state: function() {},
};



$(document).ready(function() {  
  covered_call_calc.initialize();
});