import copy
import unittest
from mazi.parallel.contract import validate_request, validate_chapter, Declined
from mazi.parallel.provider import generate, fake_chapter, BadOutput


def request(depth=0):
    return {'origin': {'about': 'Student', 'whatIf': 'I moved abroad', 'startYear': 2022, 'tone': 'cinematic'},
            'path': [{'title': 'A turn', 'year': 2022+i, 'choice': 'Stay', 'keyEvents': ['A new job']} for i in range(depth)],
            'state': {'location': 'A city', 'career': 'Student', 'finances': 50, 'relationships': 50, 'freedom': 50, 'wellbeing': 50},
            'choice': {'label': 'Stay', 'description': 'Build a new routine'} if depth else None, 'depth': depth}


class ContractTests(unittest.TestCase):
    def test_limits_and_path_consistency(self):
        for depth in range(4): self.assertEqual(validate_request(request(depth))['depth'], depth)
        for mutate in (lambda r:r.update(depth=4), lambda r:r['origin'].update(whatIf='x'*281),
                       lambda r:r.update(depth=True), lambda r:r.update(path=[{}]),
                       lambda r:r['state'].update(finances=float('nan'))):
            r=request(); mutate(r)
            with self.assertRaises(ValueError): validate_request(r)
        r=request(); r['origin']['about']='Stu\x00dent'; self.assertEqual(validate_request(r)['origin']['about'],'Student')
    def test_output_clamps_shape_and_year(self):
        for depth in range(4):
            r=validate_request(request(depth)); result=generate(r)
            self.assertEqual(len(result['choices']), [3,2,2,0][depth])
            self.assertEqual(bool(result['ending']), depth==3)
        r=request(); raw=fake_chapter(r); raw['deltas']['finances']=900
        self.assertEqual(validate_chapter(raw,r)['state']['finances'],65)
        for change in ({'year':2100},{'narrative':'short'},{'choices':[]}):
            bad={**fake_chapter(r),**change}
            with self.assertRaises(ValueError): validate_chapter(bad,r)
    def test_bad_output_retries_once(self):
        calls=[]
        def bad(r): calls.append(1); return {}
        with self.assertRaises(BadOutput): generate(request(),bad)
        self.assertEqual(len(calls),2)
    def test_sensitive_input_does_not_generate(self):
        for text in ('I want to kill myself', 'intihar etmek', 'suicide'):
            r=request();r['origin']['whatIf']=text
            with self.assertRaises(Declined): validate_request(r)

    def test_sample_evaluation(self):
        from mazi.parallel.evaluate import evaluate
        self.assertEqual(evaluate()['chapters'],48)
